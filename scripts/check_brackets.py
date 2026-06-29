from pathlib import Path
p = Path('src/screens/ProfileScreen.js')
text = p.read_text(encoding='utf-8')
stack = []
pairs = {')': '(', ']': '[', '}': '{'}
line = 1
col = 0
for ch in text:
    col += 1
    if ch == '\n':
        line += 1
        col = 0
        continue
    if ch in '([{':
        stack.append((ch, line, col))
    elif ch in ')]}}':
        if not stack:
            print('extra close', ch, line, col)
            break
        expected = pairs[ch]
        top = stack[-1][0]
        if top != expected:
            print('mismatch', ch, line, col, 'expected for', top, 'opened at', stack[-1])
            break
        stack.pop()
else:
    print('done, remaining', len(stack), stack[-5:])
