# -*- coding: utf-8 -*-
"""スキャンPDF名簿の読み取り用ビュー生成ヘルパー。

使い方(スクラッチパッド内で実行する):

  # 1) レンダリング(300dpi)
  python3 pdf_views.py render input.pdf prefix --first 1 --last 3

  # 2) ページ全体ビュー(見開きの半分を判読可能サイズに縮小)
  python3 pdf_views.py view prefix-01.png view_right.png --box 1660 250 3508 2480 --scale 0.75

  # 3) 拡大検証クロップ
  python3 pdf_views.py zoom prefix-01.png zoom1.png --box 2560 1560 3150 2120 --scale 3

生成したPNGを Read ツールで読む。全体ビューは幅1300〜1500px程度が判読の目安。
"""
import argparse
import subprocess
import sys

from PIL import Image


def render(pdf, prefix, first, last, dpi=300):
    cmd = ["pdftoppm", "-r", str(dpi), "-png"]
    if first:
        cmd += ["-f", str(first)]
    if last:
        cmd += ["-l", str(last)]
    cmd += [pdf, prefix]
    subprocess.run(cmd, check=True)
    print("rendered", pdf, "->", prefix + "-*.png")


def crop_scale(src, dst, box, scale):
    im = Image.open(src)
    if box:
        im = im.crop(tuple(box))
    if scale and scale != 1:
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    im.save(dst)
    print("saved", dst, im.size)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("render", help="PDFを300dpiでPNG化")
    r.add_argument("pdf")
    r.add_argument("prefix")
    r.add_argument("--first", type=int, default=None)
    r.add_argument("--last", type=int, default=None)
    r.add_argument("--dpi", type=int, default=300)

    for name, default_scale in (("view", 0.75), ("zoom", 3.0)):
        v = sub.add_parser(name, help="クロップ+拡大縮小")
        v.add_argument("src")
        v.add_argument("dst")
        v.add_argument("--box", type=int, nargs=4, default=None,
                       metavar=("X0", "Y0", "X1", "Y1"))
        v.add_argument("--scale", type=float, default=default_scale)

    a = p.parse_args()
    if a.cmd == "render":
        render(a.pdf, a.prefix, a.first, a.last, a.dpi)
    else:
        crop_scale(a.src, a.dst, a.box, a.scale)


if __name__ == "__main__":
    sys.exit(main())
