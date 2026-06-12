import os, re, ssl, urllib.request

urls = [u.strip() for u in os.environ.get("URLS", "").splitlines() if u.strip()]
batch = os.environ.get("BATCH", "batch")
outdir = os.path.join("out", batch)
os.makedirs(outdir, exist_ok=True)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
}
index = []
for i, u in enumerate(urls):
    base = os.path.join(outdir, "%03d" % i)
    try:
        req = urllib.request.Request(u, headers=HEADERS)
        r = urllib.request.urlopen(req, timeout=40, context=ctx)
        data = r.read()
        status = getattr(r, "status", None) or r.getcode()
        final = r.geturl()
    except Exception as e:
        index.append("%03d\tERROR\t%s\t%r" % (i, u, e))
        continue
    with open(base + ".html", "wb") as f:
        f.write(data)
    text = None
    for enc in ("utf-8", "cp932", "euc-jp"):
        try:
            text = data.decode(enc)
            break
        except Exception:
            pass
    if text is None:
        text = data.decode("utf-8", "replace")
    t = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", text)
    imgs = re.findall(r"(?is)<img[^>]+>", t)
    links = re.findall(r"(?is)<a\s[^>]*href=[\"']([^\"'#]+)[\"'][^>]*>(.*?)</a>", t)
    t2 = re.sub(r"(?s)<[^>]+>", "\n", t)
    t2 = re.sub(r"\n\s*\n+", "\n", t2)
    with open(base + ".txt", "w", encoding="utf-8") as f:
        f.write("URL: %s\nFINAL: %s\nSTATUS: %s\n\n" % (u, final, status))
        f.write(t2)
        f.write("\n\n==== IMG TAGS ====\n")
        f.write("\n".join(imgs))
        f.write("\n\n==== LINKS ====\n")
        for href, label in links:
            label2 = re.sub(r"(?s)<[^>]+>", "", label).strip()
            f.write("%s\t%s\n" % (href, label2[:80]))
    index.append("%03d\tOK %s\t%s\t%d bytes" % (i, status, u, len(data)))
with open(os.path.join(outdir, "INDEX.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(index) + "\n")
print("\n".join(index))
