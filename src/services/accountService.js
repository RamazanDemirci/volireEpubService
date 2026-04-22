import sql from "../config/db.js";

export const accountService = {
  async syncAccount(email, displayName) {
    // 1. Account bul veya oluştur
    let [account] =
      await sql`SELECT * FROM accounts WHERE id = ${email} OR email = ${email}`;

    if (!account) {
      [account] = await sql`
        INSERT INTO accounts (id, email, display_name)
        VALUES (${email}, ${email}, ${displayName || email})
        RETURNING *
      `;
      // Yeni kullanıcıya ilk profil
      await this.createProfile(account.id, "Ana Profil", 1);
    }

    // 2. Profilleri çek (Android modelleriyle %100 uyumlu alias'lar kullanıldı)
    const profiles = await sql`
      SELECT 
        id, 
        account_id as "accountId", 
        name, 
        avatar_id as "avatarResId", 
        settings, 
        reader_params as "readerParams", 
        last_book_id as "lastBookId",
        library_book_ids as "libraryBookIds",
        book_progress_map as "bookProgressMap"
      FROM profiles 
      WHERE account_id = ${account.id}
    `;

    return {
      account: {
        id: account.id,
        email: account.email || account.id,
        display_name: account.display_name,
        last_used_profile_id: account.last_used_profile_id,
      },
      profiles: profiles || [],
    };
  },

  async createProfile(accountId, name, avatarId = 1) {
    const [newProfile] = await sql`
      INSERT INTO profiles (
        id, account_id, name, avatar_id, 
        settings, reader_params, library_book_ids, book_progress_map
      ) VALUES (
        ${"profile_" + Date.now()}, 
        ${accountId}, 
        ${name}, 
        ${avatarId}, 
        ${sql.json({})}, 
        ${sql.json({})}, 
        ${sql.array([])}, 
        ${sql.json({})}
      )
      RETURNING *
    `;
    return newProfile;
  },

  async updateProfile(profileId, data) {
    const [updated] = await sql`
      UPDATE profiles SET
        name = ${data.name || sql`name`},
        settings = ${data.settings ? sql.json(data.settings) : sql`settings`},
        reader_params = ${data.reader_params ? sql.json(data.reader_params) : sql`reader_params`},
        last_book_id = ${data.last_book_id || sql`last_book_id`},
        library_book_ids = ${data.library_book_ids ? sql.array(data.library_book_ids) : sql`library_book_ids`},
        book_progress_map = ${data.book_progress_map ? sql.json(data.book_progress_map) : sql`book_progress_map`}
      WHERE id = ${profileId}
      RETURNING *
    `;
    return updated;
  },
};
