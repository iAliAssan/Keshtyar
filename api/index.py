import sys
import os

# مسیر پروژه را به sys.path اضافه کنید
project_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_path)

from app import app

# این متغیر برای Vercel ضروری است
application = app
