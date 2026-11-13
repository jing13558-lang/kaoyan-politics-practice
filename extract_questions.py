"""Extract all supplied politics papers into the static site's question bank."""

import json
import re
import unicodedata
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).parent
PAPERS = sorted(ROOT.parent.glob("zhenti-20*.pdf"))
OUT = ROOT / "dist" / "papers.json"
RADICALS = str.maketrans("⻅⻢⻚⺠⻛⻉⻋⻓⻘⻩⻆⻔", "见马页民风贝车长青黄角门")

def normalize(value):
    for i, symbol in enumerate("①②③④", start=1):
        value = value.replace(symbol, chr(0xE000 + i))
    value = unicodedata.normalize("NFKC", value.translate(RADICALS))
    for i, symbol in enumerate("①②③④", start=1):
        value = value.replace(chr(0xE000 + i), symbol)
    return re.sub(r"[ \t]+", " ", value).strip()

def compact(value):
    value = normalize(value)
    value = re.sub(r"\s*\n\s*", "", value)
    return re.sub(r"\s+([,。?!;:、])", r"\1", value)

def read_paper(path):
    year = int(re.search(r"20\d\d", path.stem).group())
    pages = [normalize(page.extract_text()) for page in PdfReader(path).pages]
    first = pages[0]
    key_matches = re.findall(r"(?<!\d)(\d{1,2})\.\s*([A-D]{1,4})(?![A-D])", first)
    answer_key = {int(number): letters for number, letters in key_matches}
    if len(answer_key) != len(key_matches):
        raise ValueError(f"{year}: duplicate number in front-page answer key")
    body = "\n".join(pages[1:])
    essay_start = re.search(r"(?m)^\s*(?:20\d\d\s*年分析题|第\s*34\s*题\s*·)", body)
    if not essay_start:
        raise ValueError(f"{year}: essay section not found")
    objective_body = body[:essay_start.start()]
    essay_body = body[essay_start.start():]
    headers = list(re.finditer(r"第\s*(\d+)\s*题\s*·\s*(单选|多选)\s*·\s*([^\n]+)", objective_body))
    questions = []
    for i, match in enumerate(headers):
        number = int(match.group(1))
        end = headers[i + 1].start() if i + 1 < len(headers) else len(objective_body)
        chunk = objective_body[match.end():end]
        answer_match = re.search(r"\n答案\s+([A-D]{1,4})\s*\n", chunk)
        if not answer_match:
            raise ValueError(f"{year} question {number}: answer missing")
        before, after = chunk[:answer_match.start()], chunk[answer_match.end():]
        option_matches = list(re.finditer(r"(?m)^\s*(✓\s*)?([A-D])\.\s*", before))
        if len(option_matches) != 4 or [m.group(2) for m in option_matches] != list("ABCD"):
            raise ValueError(f"{year} question {number}: invalid options")
        options = {}
        for j, opt in enumerate(option_matches):
            stop = option_matches[j + 1].start() if j + 1 < 4 else len(before)
            option_text = compact(before[opt.end():stop])
            options[opt.group(2)] = re.sub(r"\s*答案[:：][A-D]{1,4}$", "", option_text)
        checked = "".join(m.group(2) for m in option_matches if m.group(1))
        answer = answer_match.group(1)
        if answer_key.get(number) != answer or checked != answer:
            raise ValueError(f"{year} question {number}: answer disagrees with key or check marks")
        header = normalize(match.group(3)).replace("本题详页 ›", "")
        topics = [x.strip() for x in header.split("·") if x.strip() and "本题详页" not in x]
        question = {
            "number": number,
            "type": match.group(2),
            "subject": topics[0] if topics else "",
            "topic": topics[-1] if topics else "",
            "stem": compact(before[:option_matches[0].start()]),
            "options": options,
            "answer": answer,
            "explanation": compact(after),
        }
        if not question["stem"] or not question["explanation"] or not all(options.values()):
            raise ValueError(f"{year} question {number}: incomplete content")
        questions.append(question)
    numbers = [q["number"] for q in questions]
    if numbers != sorted(answer_key):
        raise ValueError(f"{year}: question numbers disagree with answer key")
    missing = [n for n in range(1, 34) if n not in numbers]
    essay_headers = list(re.finditer(r"第\s*(3[4-8])\s*题\s*·\s*([^\n]+)", essay_body))
    essays = []
    for i, match in enumerate(essay_headers):
        number = int(match.group(1))
        end = essay_headers[i + 1].start() if i + 1 < len(essay_headers) else len(essay_body)
        content = essay_body[match.end():end]
        content = re.split(r"(?:背这道参考要点|这道题详页|在线做这套卷|时间不够整卷)", content)[0]
        header = normalize(match.group(2))
        topics = [x.strip() for x in header.split("·") if x.strip()]
        essays.append({
            "number": number,
            "subject": topics[0] if topics else "",
            "topic": topics[-1] if topics else "",
            "content": compact(content),
        })
    if [q["number"] for q in essays] != list(range(34, 39)):
        raise ValueError(f"{year}: incomplete essay section")
    return {"year": year, "questions": questions, "essays": essays, "missing": missing}

if __name__ == "__main__":
    papers = [read_paper(path) for path in PAPERS]
    if [paper["year"] for paper in papers] != list(range(2015, 2027)):
        raise ValueError("Expected continuous paper years from 2015 through 2026")
    OUT.write_text(json.dumps(papers, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for paper in papers:
        print(paper["year"], len(paper["questions"]), "objective questions, missing", paper["missing"], "essays", len(paper["essays"]))
    print("Wrote", OUT)
