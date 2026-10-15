"""Проверка словарей: те же ключи, что в русском мастере, и те же ICU-плейсхолдеры.

Запуск: python scripts/check-messages.py [locale ...]
"""
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "messages"
SITE = ["en", "tk", "tr", "uz", "kk", "ky", "az", "fr"]
STAFF = ["en", "tk"]
PLACEHOLDER = re.compile(r"\{(\w+)(?:,\s*(plural|select)\b)?")


def flatten(d, prefix=""):
    out = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def placeholders(s):
    # имена аргументов верхнего уровня; # и категории plural не считаем
    return {m.group(1) for m in PLACEHOLDER.finditer(s) if m.group(1) not in ("one", "few", "many", "other", "zero", "two")}


def check(locale, name):
    master = flatten(json.load(io.open(ROOT / "ru" / f"{name}.json", encoding="utf-8")))
    path = ROOT / locale / f"{name}.json"
    if not path.exists():
        return [f"{path}: файл отсутствует"]
    target = flatten(json.load(io.open(path, encoding="utf-8")))
    errors = []
    for k in master.keys() - target.keys():
        errors.append(f"{locale}/{name}: нет ключа {k}")
    for k in target.keys() - master.keys():
        errors.append(f"{locale}/{name}: лишний ключ {k}")
    for k in master.keys() & target.keys():
        if placeholders(str(master[k])) != placeholders(str(target[k])):
            errors.append(f"{locale}/{name}: плейсхолдеры {k}: {placeholders(str(master[k]))} != {placeholders(str(target[k]))}")
        if "plural," in str(master[k]) and "other {" not in str(target[k]):
            errors.append(f"{locale}/{name}: {k} — в plural нужна категория other")
    return errors


def main():
    locales = sys.argv[1:] or SITE
    errors = []
    for loc in locales:
        errors += check(loc, "site")
        if loc in STAFF:
            errors += check(loc, "staff")
    for e in errors:
        print(e)
    print("OK" if not errors else f"Ошибок: {len(errors)}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
