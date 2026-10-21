"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { attachLogo, removeLogo } from "@/app/(app)/settings/actions";

const BUCKET = "school-assets";
const LOGO_PATH = "logo.png";
const MAX_BYTES = 1024 * 1024;

export default function LogoUpload({ currentUrl }: { currentUrl: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function upload() {
    if (!file || busy) return;
    setError(null);
    setDone(null);
    try {
      setBusy("Uploading...");
      // Keep transparency and cap the size so the logo loads fast on every printed page.
      const blob = await compressImage(file, 600, 1, { png: true });
      if (blob.size > MAX_BYTES) throw new Error("The logo is still larger than 1 MB after shrinking. Use a simpler image.");
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(LOGO_PATH, blob, { upsert: true, contentType: "image/png", cacheControl: "60" });
      if (upErr) {
        throw new Error(
          /bucket not found/i.test(upErr.message)
            ? "The logo storage is missing. Run supabase/006_logo_idcards.sql in the Supabase SQL Editor first."
            : upErr.message
        );
      }
      const saved = await attachLogo();
      if ("error" in saved) throw new Error(saved.error);
      setFile(null);
      setDone("Logo updated. It now appears on invoices, admission forms and ID cards.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The logo could not be uploaded.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (busy) return;
    setError(null);
    setDone(null);
    setBusy("Removing...");
    const res = await removeLogo();
    setBusy(null);
    if ("error" in res) return setError(res.error);
    setDone("Logo removed.");
    router.refresh();
  }

  const shown = preview ?? currentUrl;

  return (
    <div className="card">
      <h2>School logo</h2>
      <p className="sub" style={{ marginTop: -6 }}>
        Printed on invoices, admission forms and student ID cards. A square or wide PNG with a transparent background works best.
      </p>
      {error && <div className="error" role="alert">{error}</div>}
      {done && <div className="notice ok">{done}</div>}
      <div className="upload">
        <div className="logo-thumb">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="School logo" />
          ) : (
            <span>No logo yet</span>
          )}
        </div>
        <div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Logo file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="row tight" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={upload} disabled={!file || Boolean(busy)}>
              {busy ?? (currentUrl ? "Replace logo" : "Upload logo")}
            </button>
            {currentUrl && !file && (
              <button type="button" className="btn danger" onClick={remove} disabled={Boolean(busy)}>Remove logo</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
