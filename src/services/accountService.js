import sql from "../config/db.js";

export const accountService = {
  // Ortak Sorgu Kalıbı: Android tarafındaki GSON/Kotlin modelleriyle %100 uyumlu
  PROFILE_SELECT_FIELDS: sql`
    id, 
    account_id as "accountId", 
    name, 
    avatar_id as "avatarResId", 
    settings, 
    reader_params as "readerParams", 
    last_book_id as "lastBookId",
    library_book_ids as "libraryBookIds",
    book_progress_map as "bookProgressMap"
  `,

  async syncAccount(email, displayName) {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Account bul veya oluştur
    let [account] =
      await sql`SELECT * FROM accounts WHERE id = ${cleanEmail} OR email = ${cleanEmail}`;

    if (!account) {
      [account] = await sql`
        INSERT INTO accounts (id, email, display_name)
        VALUES (${cleanEmail}, ${cleanEmail}, ${displayName || cleanEmail})
        RETURNING *
      `;
      // Yeni kullanıcıya otomatik ilk profil
      await this.createProfile(account.id, "Ana Profil", 1);
    }

    // 2. Profilleri çek
    const profiles = await sql`
      SELECT ${this.PROFILE_SELECT_FIELDS}
      FROM profiles 
      WHERE account_id = ${account.id}
      ORDER BY id ASC
    `;

    return {
      account: {
        id: account.id,
        email: account.email || account.id,
        displayName: account.display_name, // Android: displayName
        lastUsedProfileId: account.last_used_profile_id, // Android: lastUsedProfileId
      },
      profiles: profiles || [],
    };
  },

  async createProfile(accountId, name, avatarId = 1) {
    const profileId = `profile_${Math.random().toString(36).substr(2, 9)}`;

    const [newProfile] = await sql`
      INSERT INTO profiles (
        id, account_id, name, avatar_id, 
        settings, reader_params, library_book_ids, book_progress_map
      ) VALUES (
        ${profileId}, ${accountId}, ${name}, ${avatarId}, 
        ${sql.json({})}, ${sql.json({})}, ${sql.array([])}, ${sql.json({})}
      )
      RETURNING ${this.PROFILE_SELECT_FIELDS}
    `;
    return newProfile;
  },

  async updateProfile(profileId, data) {
    const [updated] = await sql`
    UPDATE profiles SET
      name = ${data.name || sql`name`},
      avatar_id = ${data.avatarResId || data.avatar_id || sql`avatar_id`},
      settings = ${data.settings ? sql.json(data.settings) : sql`settings`},
      reader_params = ${data.readerParams || data.reader_params ? sql.json(data.readerParams || data.reader_params) : sql`reader_params`},
      last_book_id = ${data.lastBookId || data.last_book_id || sql`last_book_id`},
      library_book_ids = ${data.libraryBookIds || data.library_book_ids ? sql.array(data.libraryBookIds || data.library_book_ids) : sql`library_book_ids`},
      book_progress_map = ${data.bookProgressMap || data.book_progress_map ? sql.json(data.bookProgressMap || data.book_progress_map) : sql`book_progress_map`}
    WHERE id = ${profileId}
    RETURNING ${this.PROFILE_SELECT_FIELDS}
  `;
    return updated;
  },

  // accountService nesnesinin içine ekle:
  async deleteProfile(profileId) {
    const [deleted] = await sql`
    DELETE FROM profiles 
    WHERE id = ${profileId} 
    RETURNING id
  `;
    if (!deleted) {
      throw new Error("Profil bulunamadı veya zaten silinmiş.");
    }
    return deleted;
  },
};
