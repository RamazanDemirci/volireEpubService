import { list } from "@vercel/blob";
import AdmZip from "adm-zip";
import crypto from "crypto";
import sql from "../config/db.js";

export const bookService = {
  /**
   * EPUB içeriğinden benzersiz parmak izi üretir
   */
  async generateFingerprint(buffer) {
    try {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      const opfEntry = zipEntries.find((e) => e.entryName.endsWith(".opf"));

      if (opfEntry) {
        const content = opfEntry.getData().toString("utf8");
        const match = content.match(
          /<dc:identifier[^>]*>(.*?)<\/dc:identifier>/,
        );
        if (match?.[1]) {
          return crypto
            .createHash("sha256")
            .update(match[1].trim())
            .digest("hex");
        }
      }

      const htmlEntry = zipEntries.find(
        (e) => e.entryName.endsWith(".html") || e.entryName.endsWith(".xhtml"),
      );
      const hashSource = htmlEntry ? htmlEntry.getData() : buffer;
      return crypto.createHash("sha256").update(hashSource).digest("hex");
    } catch (e) {
      return crypto.createHash("sha256").update(buffer).digest("hex");
    }
  },

  /**
   * Kitap listesini getirirken isim önceliğini yönetir:
   * Profile Name > Metadata Name > Filename
   */
  async getEnrichedBookList(email, profileId) {
    const targetPath = `inbox/${email.trim()}/${profileId ? profileId.trim() + "/" : ""}`;
    const { blobs } = await list({ prefix: targetPath });

    if (!blobs?.length) return [];

    const blobData = blobs.map((b) => {
      const fileName = b.pathname.split("/").pop();
      return {
        id: fileName.replace(".epub", ""),
        fileName,
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt,
      };
    });

    const ids = blobData.map((b) => b.id);

    // SQL: Tek sorguda hem genel metadata hem profile özel isimler
    const dbData = await sql`
      SELECT 
        m.id, 
        m.original_name, 
        p.display_name 
      FROM book_metadata m
      LEFT JOIN profile_books p ON p.book_id = m.id AND p.profile_id = ${profileId}
      WHERE m.id = ANY(${ids})
    `;

    const nameMap = new Map(
      dbData.map((row) => [row.id, row.display_name || row.original_name]),
    );

    return blobData.map((b) => ({
      ...b,
      name: nameMap.get(b.id) || b.fileName,
    }));
  },

  async updateDisplayName(profileId, bookId, newName) {
    return await sql`
      INSERT INTO profile_books (profile_id, book_id, display_name)
      VALUES (${profileId}, ${bookId}, ${newName})
      ON CONFLICT (profile_id, book_id) 
      DO UPDATE SET display_name = ${newName}
      RETURNING *
    `;
  },
};
