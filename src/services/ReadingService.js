const AdmZip = require("adm-zip");
const iconv = require("iconv-lite");
const he = require("he");
const path = require("path");

const ReadingService = {
  getChapterContent: (fileName, chapterId) => {
    const fullPath = path.join(__dirname, "../../resources/epub", fileName);
    const zip = new AdmZip(fullPath);
    const entries = zip
      .getEntries()
      .filter((e) => e.entryName.match(/\.(html|xhtml)$/i))
      .sort((a, b) => a.entryName.localeCompare(b.entryName));

    if (!entries[chapterId]) throw new Error("Bölüm yok");

    const rawBuffer = entries[chapterId].getData();
    let text = iconv.decode(rawBuffer, "utf-8");
    if (!/[ğüşİıöç]/.test(text)) text = iconv.decode(rawBuffer, "win1254");

    return he
      .decode(text)
      .replace(
        /<style([\s\S]*?)<\/style>|<script([\s\S]*?)<\/script>|<[^>]*>?/gim,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
  },
};

module.exports = ReadingService;
