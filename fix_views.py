p = r'C:/Users/User/Desktop/Chariot/chariot_backend/catalog/views.py'
with open(p, 'r', encoding='utf8') as f:
    s = f.read()
# Replace literal backslash-n sequences with actual newlines
s = s.replace('\\n', '\n')
# Fix any concatenated context->return sequence
s = s.replace('context={"request": request}\n            return Response', 'context={"request": request})\n        return Response')
with open(p, 'w', encoding='utf8') as f:
    f.write(s)
print('fix_views.py wrote changes to', p)
