# wsgi.py
# فایل ورودی WSGI برای اجرا در PythonAnyware، Gunicorn، uWSGI و ...

import sys
import os

# اضافه کردن مسیر پروژه به PATH
project_path = os.path.dirname(os.path.abspath(__file__))
if project_path not in sys.path:
    sys.path.insert(0, project_path)

# ایمپورت اپلیکیشن Flask از فایل app.py
from app import app as application

# برای PythonAnywhere، متغیر application باید وجود داشته باشد
# همچنین می‌توانید برای دیباگ، مقدار debug را false کنید
if __name__ == "__main__":
    application.run()