import { put } from "@vercel/blob";
import AdmZip from "adm-zip";
import crypto from "crypto";
import sql from "../config/db.js";

export const bookService = {
  // EPUB içeriğinden parmak izi üretir
  async generateFingerprint(buffer) {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    // 1. Önce ISBN veya Unique Identifier aramaya çalış (content.opf içinde)
    const opfEntry = zipEntries.find((e) => e.entryName.endsWith(".opf"));
    if (opfEntry) {
      const content = opfEntry.getData().toString("utf8");
      const match = content.match(/<dc:identifier[^>]*>(.*?)<\/dc:identifier>/);
      if (match && match[1]) {
        return crypto
          .createHash("sha256")
          .update(match[1].trim())
          .digest("hex");
      }
    }

    // 2. ISBN yoksa, ilk büyük metin dosyasının hash'ini al (Genelde Bölüm 1)
    const htmlEntry = zipEntries.find(
      (e) => e.entryName.endsWith(".html") || e.entryName.endsWith(".xhtml"),
    );
    if (htmlEntry) {
      return crypto
        .createHash("sha256")
        .update(htmlEntry.getData())
        .digest("hex");
    }

    // 3. Hiçbir şey bulunamazsa tüm dosyanın hash'ini al
    return crypto.createHash("sha256").update(buffer).digest("hex");
  },

  async ingestBook(userId, fileName, fileBlobBase64) {
    const buffer = Buffer.from(fileBlobBase64, "base64");
    const fingerprint = await this.generateFingerprint(buffer);

    return await sql.begin(async (sql) => {
      // 1. Bu parmak izi daha önce kaydedilmiş mi?
      let [metadata] = await sql`
        SELECT * FROM book_metadata WHERE fingerprint = ${fingerprint}
      `;

      if (!metadata) {
        // Yeni bir UUID oluştur ve kaydet
        const newId = crypto.randomUUID();
        [metadata] = await sql`
          INSERT INTO book_metadata (id, fingerprint, original_name)
          VALUES (${newId}, ${fingerprint}, ${fileName})
          RETURNING *
        `;
      }

      // 2. Vercel Blob'a UUID ismiyle yükle
      const blob = await put(`inbox/${userId}/${metadata.id}.epub`, buffer, {
        access: "public",
        contentType: "application/epub+zip",
      });

      return {
        id: metadata.id,
        name: fileName,
        url: blob.url,
        fingerprint: fingerprint,
      };
    });
  },
};
