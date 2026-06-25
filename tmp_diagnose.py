from pathlib import Path
from babel import parser
from babel import traverse

source = Path('src/screens/HomeScreen.js').read_text('utf-8')
try:
    ast = parser.parse(source, source_type='module', plugins=['jsx','classProperties'])
    print('parsed ok')
except Exception as e:
    print(type(e).__name__, e)
    if hasattr(e, 'loc'):
        print('loc', e.loc)
