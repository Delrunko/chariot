import urllib.request, urllib.error, json, sys

login_url = 'http://127.0.0.1:8000/api/auth/login/'
admin_url = 'http://127.0.0.1:8000/api/purchases/admin/service/'
creds = {'username':'admin1','password':'123456'}

try:
    req = urllib.request.Request(login_url, data=json.dumps(creds).encode('utf-8'), headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=10) as r:
        body = r.read().decode('utf-8')
        status = r.getcode()
    print('LOGIN STATUS', status)
    print('LOGIN BODY', body)
    if status == 200:
        token = json.loads(body).get('access')
        headers = {'Authorization': f'Bearer {token}'}
        req2 = urllib.request.Request(admin_url, headers=headers)
        with urllib.request.urlopen(req2, timeout=10) as s:
            s_body = s.read().decode('utf-8')
            s_status = s.getcode()
        print('\nADMIN GET STATUS', s_status)
        print('ADMIN BODY (truncated) ', s_body[:2000])
    else:
        print('\nLogin failed; cannot call admin endpoint')
except urllib.error.HTTPError as e:
    try:
        err_body = e.read().decode('utf-8')
    except Exception:
        err_body = str(e)
    print('HTTPError', e.code, err_body)
    sys.exit(1)
except Exception as e:
    print('ERROR', e)
    sys.exit(1)
