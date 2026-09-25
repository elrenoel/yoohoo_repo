// Small deterministic PDF fixture; offsets are computed in bytes, not characters.
export function samplePdf() {
  const text = "Virtual memory maps logical addresses to physical memory. Paging divides memory into fixed size pages. A page fault occurs when a required page is absent from RAM. The operating system loads the page from disk. Page tables store address mappings. A translation lookaside buffer caches recent mappings to improve memory access speed.";
  const stream = `BT /F1 10 Tf 30 750 Td (${text.slice(0, 100)}) Tj 0 -20 Td (${text.slice(100, 200)}) Tj 0 -20 Td (${text.slice(200, 300)}) Tj 0 -20 Td (${text.slice(300)}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 900 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf));
}
