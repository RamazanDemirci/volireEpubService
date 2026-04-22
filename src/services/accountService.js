import sql from "../config/db.js";

export const accountService = {
  // Kullanıcı giriş yaptığında (veya uygulama açıldığında) çalışır
  async syncAccount(email, displayName) {
    return await sql.begin(async (sql) => {
      // 1. Account var mı kontrol et, yoksa oluştur (LDAP mantığı)
      const [account] = await sql`
        INSERT INTO accounts (id, display_name)
        VALUES (${email}, ${displayName})
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
        RETURNING *
      `;

      // 2. Hesaba bağlı profilleri getir
      let profiles =
        await sql`SELECT * FROM profiles WHERE account_id = ${email}`;

      // 3. Eğer hiç profil yoksa (Yeni kullanıcı), "Ana Profil" oluştur
      if (profiles.length === 0) {
        const [newProfile] = await sql`
          INSERT INTO profiles (id, account_id, name, avatar_id)
          VALUES (${`profile_${Date.now()}`}, ${email}, 'Ana Profil', 1)
          RETURNING *
        `;
        profiles = [newProfile];

        // Account tablosunda son kullanılan profili güncelle
        await sql`UPDATE accounts SET last_used_profile_id = ${newProfile.id} WHERE id = ${email}`;
      }

      return { account, profiles };
    });
  },

  async updateProfile(profileId, data) {
    const { name, settings, reader_params, last_book_id } = data;
    const [updated] = await sql`
      UPDATE profiles SET
        name = COALESCE(${name}, name),
        settings = ${settings ? JSON.stringify(settings) : sql`settings`},
        reader_params = ${reader_params ? JSON.stringify(reader_params) : sql`reader_params`},
        last_book_id = COALESCE(${last_book_id}, last_book_id),
        updated_at = NOW()
      WHERE id = ${profileId}
      RETURNING *
    `;
    return updated;
  },
};
