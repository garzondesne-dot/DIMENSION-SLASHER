# 배포용 단독 HTML 만들기: index.html + css + js 를 파일 하나로 합친다 (게임 실행에는 필요 없음)
#   python3 tools/bundle.py 출력.html            → 파일로 여는 판 / Apps Script game.html 로 붙여 넣는 판 (같은 파일)
#   python3 tools/bundle.py 출력.html <웹앱URL>   → 파일로 열어도 결과를 그 주소로 보내는 판
import os, re, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
out, url = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else '')
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
h = rd('index.html')
h = h.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + rd('css/style.css') + '\n</style>')
srcs = re.findall(r'<script src="(js/[^"]+)"></script>', h)
for s in srcs:
    js = rd(s)
    if s == 'js/data.js' and url:
        js = js.replace("DS.REPORT_URL = '';", 'DS.REPORT_URL = %r;' % url)
    h = h.replace('<script src="%s"></script>' % s, '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>')
assert '<script src="js/' not in h and '<?' not in h  # Apps Script 템플릿 기호와 겹치지 않게
open(out, 'w', encoding='utf-8').write(h)
print(out, len(srcs), 'scripts', len(h), 'bytes')
