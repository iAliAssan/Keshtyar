// static/dashboard.js
// توابع جاوااسکریپت برای دستیار هوشمند کشاورزی
// نسخه نهایی با بهبود حالت تاریک، انیمیشن‌ها و پشتیبانی از کالیبراسیون

// ==================== Utility Functions ====================

// نمایش نوتیفیکیشن
function showNotification(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.style.maxWidth = '90%';
    alertDiv.style.textAlign = 'center';
    alertDiv.style.animation = 'fadeInUp 0.3s ease-out';
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => {
        alertDiv.remove();
    }, 4000);
}

// دریافت خودکار موقعیت مکانی
function getCurrentLocation(latInputId, lonInputId, callback) {
    if (!navigator.geolocation) {
        showNotification('مرورگر شما از دریافت موقعیت پشتیبانی نمی‌کند', 'danger');
        return false;
    }

    const btn = event ? event.target : null;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال دریافت...';
    }

    navigator.geolocation.getCurrentPosition(
        function(position) {
            if (latInputId && lonInputId) {
                document.getElementById(latInputId).value = position.coords.latitude.toFixed(6);
                document.getElementById(lonInputId).value = position.coords.longitude.toFixed(6);
            }
            showNotification('موقعیت مکانی با موفقیت دریافت شد', 'success');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-check-circle"></i> دریافت شد';
                setTimeout(() => {
                    if (btn) btn.innerHTML = '<i class="fas fa-crosshairs"></i> دریافت موقعیت خودکار';
                }, 2000);
            }
            if (callback) callback(position.coords.latitude, position.coords.longitude);
        },
        function(error) {
            let errorMsg = '';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = 'دسترسی به موقعیت مکانی رد شد';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = 'اطلاعات موقعیت در دسترس نیست';
                    break;
                case error.TIMEOUT:
                    errorMsg = 'زمان دریافت موقعیت به پایان رسید';
                    break;
                default:
                    errorMsg = 'خطا در دریافت موقعیت';
            }
            showNotification(errorMsg, 'danger');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطا';
                setTimeout(() => {
                    if (btn) btn.innerHTML = '<i class="fas fa-crosshairs"></i> دریافت موقعیت خودکار';
                }, 2000);
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
    return true;
}

// ==================== Chart Functions ====================

function createLineChart(ctx, label, data, color, borderColor, maxY = null) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.timestamps || [],
            datasets: [{
                label: label,
                data: data.values || [],
                borderColor: borderColor || color,
                backgroundColor: color,
                tension: 0.3,
                fill: true,
                pointRadius: data.timestamps && data.timestamps.length > 24 ? 2 : 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top', rtl: true, labels: { font: { family: 'Vazirmatn' } } },
                tooltip: { rtl: true, mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: true, max: maxY, title: { display: true, text: label } },
                x: { title: { display: true, text: 'زمان' }, ticks: { maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 10 } }
            }
        }
    });
}

function initSoilMoistureChart(chartData) {
    const canvas = document.getElementById('soilChart');
    if (!canvas) return;
    return createLineChart(canvas.getContext('2d'), 'رطوبت خاک (%)',
        { timestamps: chartData.timestamps, values: chartData.soil_moisture },
        'rgba(156, 176, 128, 0.1)', '#9CB080', 100);
}

function initTemperatureChart(chartData) {
    const canvas = document.getElementById('tempChart');
    if (!canvas) return;
    return createLineChart(canvas.getContext('2d'), 'دما (°C)',
        { timestamps: chartData.timestamps, values: chartData.temperature },
        'rgba(220, 53, 69, 0.1)', '#dc3545', null);
}

function initTankLevelChart(chartData) {
    const canvas = document.getElementById('tankChart');
    if (!canvas) return;
    return createLineChart(canvas.getContext('2d'), 'سطح تانک (%)',
        { timestamps: chartData.timestamps, values: chartData.tank_level },
        'rgba(23, 162, 184, 0.1)', '#17a2b8', 100);
}

// ==================== Real-time Dashboard ====================

let autoRefreshInterval = null;
function startAutoRefresh(intervalSeconds = 60) {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && !window.location.pathname.includes('/dashboard')) {
            location.reload();
        }
    }, intervalSeconds * 1000);
}
function stopAutoRefresh() { if (autoRefreshInterval) clearInterval(autoRefreshInterval); }

// ==================== Copy to Clipboard ====================
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return false;
    const text = element.value || element.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showNotification('متن کپی شد', 'success');
        return true;
    }).catch(() => {
        showNotification('خطا در کپی متن', 'danger');
        return false;
    });
}

// ==================== Form Validation ====================
function validatePassword(password, confirmId) {
    if (password.length < 4) {
        showNotification('رمز عبور باید حداقل ۴ کاراکتر باشد', 'danger');
        return false;
    }
    const confirm = document.getElementById(confirmId);
    if (confirm && password !== confirm.value) {
        showNotification('رمز عبور و تکرار آن مطابقت ندارند', 'danger');
        return false;
    }
    return true;
}

function validateDeviceCode(code) {
    const regex = /^[A-Z0-9]{8}$/;
    if (!regex.test(code)) {
        showNotification('کد یکتا باید ۸ کاراکتر (حروف بزرگ و اعداد) باشد', 'danger');
        return false;
    }
    return true;
}

// ==================== Dark Mode Toggle (Improved) ====================
function initDarkMode() {
    const existingBtn = document.querySelector('.dark-mode-toggle');
    if (existingBtn) existingBtn.remove();

    const darkModeToggle = document.createElement('button');
    darkModeToggle.className = 'dark-mode-toggle';
    darkModeToggle.setAttribute('aria-label', 'تغییر حالت تاریک/روشن');
    darkModeToggle.innerHTML = '<i class="fas fa-moon"></i> حالت تاریک';
    darkModeToggle.onclick = function() {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('darkMode', 'enabled');
            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i> حالت روشن';
            showNotification('حالت تاریک فعال شد', 'info');
        } else {
            localStorage.setItem('darkMode', 'disabled');
            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i> حالت تاریک';
            showNotification('حالت روشن فعال شد', 'info');
        }
        // اضافه کردن انیمیشن ملایم
        document.querySelectorAll('.card, .stat-card').forEach(el => {
            el.classList.add('pulse');
            setTimeout(() => el.classList.remove('pulse'), 500);
        });
    };

    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i> حالت روشن';
    }
    document.body.appendChild(darkModeToggle);
}

// ==================== Device Config Page ====================
function updateConnectionStatus() {
    const statusDiv = document.getElementById('connectionStatus');
    if (!statusDiv) return;
    fetch('/api/last_sensor_data')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.last_update) {
                const lastUpdate = new Date(data.last_update);
                const now = new Date();
                const diffMinutes = Math.floor((now - lastUpdate) / 60000);
                if (diffMinutes < 5) {
                    statusDiv.innerHTML = `
                        <div class="text-success"><i class="fas fa-check-circle fa-4x mb-2"></i>
                        <h5>دستگاه متصل است</h5><p class="text-muted small">آخرین ارتباط: ${diffMinutes} دقیقه پیش</p>
                        <span class="badge bg-success">آنلاین</span></div>`;
                } else {
                    statusDiv.innerHTML = `
                        <div class="text-warning"><i class="fas fa-exclamation-triangle fa-4x mb-2"></i>
                        <h5>ارتباط قطع است</h5><p class="text-muted small">آخرین ارتباط: ${diffMinutes} دقیقه پیش</p>
                        <span class="badge bg-warning">قطع</span></div>`;
                }
            } else {
                statusDiv.innerHTML = `<div class="text-secondary"><i class="fas fa-microchip fa-4x mb-2"></i>
                <h5>هنوز داده‌ای دریافت نشده</h5><p class="text-muted small">پس از راه‌اندازی دستگاه، وضعیت در اینجا نمایش داده می‌شود</p>
                <span class="badge bg-secondary">در انتظار</span></div>`;
            }
        })
        .catch(error => {
            console.error('Error checking status:', error);
            statusDiv.innerHTML = `<div class="text-danger"><i class="fas fa-times-circle fa-4x mb-2"></i>
            <h5>خطا در بررسی وضعیت</h5><p class="text-muted small">لطفاً صفحه را دوباره بارگذاری کنید</p></div>`;
        });
}

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', function() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    if (getLocationBtn) {
        getLocationBtn.addEventListener('click', function(e) {
            getCurrentLocation('latitude', 'longitude');
        });
    }

    document.querySelectorAll('.copyable').forEach(el => {
        el.addEventListener('click', function() { copyToClipboard(this.id); });
    });

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            const deviceCode = document.getElementById('device_code');
            const password = document.getElementById('password');
            if (deviceCode && !validateDeviceCode(deviceCode.value)) {
                e.preventDefault();
                deviceCode.focus();
                return false;
            }
            if (password && !validatePassword(password.value, 'password_confirm')) {
                e.preventDefault();
                password.focus();
                return false;
            }
        });
    }

    initDarkMode();
    if (window.location.pathname.includes('/device_config')) {
        updateConnectionStatus();
        setInterval(updateConnectionStatus, 30000);
    }
});