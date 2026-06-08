import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SubmitSchema = z.object({
  plan_id: z.string().uuid(),
  method: z.enum(["gcash", "maya"]),
  // Data URL: data:image/png;base64,...
  image_data_url: z.string().regex(/^data:image\/(png|jpe?g|webp);base64,/),
});

const OcrSchema = z.object({
  reference_number: z.string().nullable(),
  amount_php: z.number().nullable(),
  paid_at_iso: z.string().nullable(),
  detected_method: z.enum(["gcash", "maya", "unknown"]).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  notes: z.string().nullable().optional(),
});

const SYSTEM_PROMPT = `You are a strict OCR validator for Philippine GCash and Maya payment receipts. Extract the following fields from the screenshot:
- reference_number: the unique transaction/reference number printed on the receipt.
- amount_php: the total amount sent in PHP as a number (no commas, no currency symbol).
- paid_at_iso: when the payment was made, as ISO 8601 UTC (assume Asia/Manila if no zone shown, then convert to UTC).
- detected_method: "gcash" if the receipt is clearly a GCash screen, "maya" if Maya/PayMaya, otherwise "unknown".
- confidence: your overall confidence that this is a genuine, unedited, readable receipt (0..1).
- notes: brief notes if anything looks suspicious (edited fonts, mismatched alignment, missing fields).

Respond ONLY with a JSON object matching the schema. Use null for any field you cannot read with confidence. Never invent values.`;

async function fetchOcr(dataUrl: string): Promise<z.infer<typeof OcrSchema>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract receipt fields. Reply with JSON only." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("AI service is busy. Please try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please contact the administrator.");
  if (!res.ok) throw new Error(`OCR failed (${res.status})`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = j.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(content);
    return OcrSchema.parse(parsed);
  } catch {
    return { reference_number: null, amount_php: null, paid_at_iso: null, detected_method: null, confidence: 0, notes: "OCR parse failed" };
  }
}

function dataUrlToBytes(url: string): { bytes: Uint8Array; ext: string; mime: string } {
  const m = url.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
  if (!m) throw new Error("Invalid image");
  const mime = m[1];
  const ext = m[2].replace("jpeg", "jpg");
  const b64 = m[3];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, ext, mime };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const submitReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    const { bytes, ext, mime } = dataUrlToBytes(data.image_data_url);
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Image too large (max 5 MB)");
    const hash = await sha256Hex(bytes);

    // duplicate image guard
    const { data: dupe } = await supabaseAdmin
      .from("payment_receipts")
      .select("id, status")
      .eq("image_sha256", hash)
      .limit(1)
      .maybeSingle();
    if (dupe) {
      return { ok: false, reason: "duplicate_image", status: "rejected" as const };
    }

    // plan
    const { data: plan } = await supabaseAdmin
      .from("membership_plans")
      .select("id, price_php, active")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan || !plan.active) throw new Error("Plan not available");
    const expectedAmount = Number(plan.price_php);

    // settings
    const { data: settingsRow } = await supabaseAdmin.from("site_settings").select("data").eq("id", "main").maybeSingle();
    const threshold = Number(
      ((settingsRow?.data as Record<string, unknown> | undefined)?.payment as Record<string, unknown> | undefined)?.ocr_confidence_threshold ?? 0.8,
    );

    // upload to private bucket
    const path = `${uid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("receipts")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(upErr.message);

    // OCR
    let ocr: z.infer<typeof OcrSchema>;
    try {
      ocr = await fetchOcr(data.image_data_url);
    } catch (e) {
      ocr = { reference_number: null, amount_php: null, paid_at_iso: null, detected_method: null, confidence: 0, notes: e instanceof Error ? e.message : "OCR error" };
    }

    // validators
    const flags: string[] = [];
    let dupRef = false;
    if (ocr.reference_number) {
      const { data: refDup } = await supabaseAdmin
        .from("payment_receipts")
        .select("id")
        .eq("ocr_reference", ocr.reference_number)
        .limit(1)
        .maybeSingle();
      if (refDup) { dupRef = true; flags.push("duplicate_reference"); }
    } else {
      flags.push("missing_reference");
    }
    const amountMatch = ocr.amount_php != null && Math.abs(ocr.amount_php - expectedAmount) < 0.5;
    if (!amountMatch) flags.push("amount_mismatch");
    const methodMatch = ocr.detected_method === data.method;
    if (!methodMatch) flags.push("method_mismatch");
    let recent = true;
    if (ocr.paid_at_iso) {
      const t = new Date(ocr.paid_at_iso).getTime();
      if (Number.isFinite(t)) {
        const ageDays = (Date.now() - t) / 86400000;
        if (ageDays > 7 || ageDays < -1) { recent = false; flags.push("stale_date"); }
      }
    }
    const passes = [amountMatch, methodMatch, recent, !dupRef, !!ocr.reference_number].filter(Boolean).length;
    const passRatio = passes / 5;
    const modelConf = Math.min(Math.max(ocr.confidence ?? 0, 0), 1);
    const finalConf = Math.round(modelConf * passRatio * 100) / 100;

    const eligibleAuto = !dupRef && amountMatch && methodMatch && recent && !!ocr.reference_number && finalConf >= threshold;
    const status: "auto_approved" | "flagged" = eligibleAuto ? "auto_approved" : "flagged";

    // insert receipt
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("payment_receipts")
      .insert({
        user_id: uid,
        plan_id: plan.id,
        method: data.method,
        image_path: path,
        image_sha256: hash,
        status,
        ocr_reference: ocr.reference_number,
        ocr_amount_php: ocr.amount_php,
        ocr_paid_at: ocr.paid_at_iso,
        ocr_method: ocr.detected_method,
        ocr_confidence: finalConf,
        ocr_raw: ocr as unknown as Record<string, unknown>,
        flags,
      })
      .select("id")
      .single();
    if (insErr) {
      // unique-ref race
      if (insErr.message?.includes("payment_receipts_ref_unique")) {
        return { ok: false, reason: "duplicate_reference", status: "rejected" as const };
      }
      throw new Error(insErr.message);
    }

    if (status === "auto_approved") {
      // create payment row → trigger grants VIP
      const { data: pay, error: payErr } = await supabaseAdmin
        .from("payments")
        .insert({
          user_id: uid,
          plan_id: plan.id,
          amount_php: expectedAmount,
          method: data.method,
          provider: "receipt",
          provider_ref: ocr.reference_number,
          status: "paid",
          raw: { receipt_id: inserted.id, ocr },
        })
        .select("id")
        .single();
      if (payErr) throw new Error(payErr.message);
      await supabaseAdmin.from("payment_receipts").update({ payment_id: pay.id }).eq("id", inserted.id);
      return { ok: true, status, confidence: finalConf, receipt_id: inserted.id };
    }

    return { ok: true, status, confidence: finalConf, receipt_id: inserted.id, flags };
  });

export const getMyReceipts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("payment_receipts")
      .select("id, plan_id, method, status, ocr_amount_php, ocr_reference, ocr_confidence, flags, created_at, admin_notes")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
