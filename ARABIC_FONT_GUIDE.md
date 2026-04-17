# Arabic Font Integration - Tajawal

## Overview
The NexCore project now supports **Tajawal** font for Arabic text. Tajawal is a modern Arabic typeface optimized for web use.

## Implementation

### 1. Font Import
Tajawal has been added to all HTML pages via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:...&family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet">
```

### 2. CSS Integration
The `assets/css/arabic.css` file contains all Arabic-specific styling and is included in all pages.

## Usage

### Method 1: Using `lang` attribute (Recommended)
```html
<p lang="ar">مرحبا بكم في NexCore</p>
<h1 lang="ar">عنوان باللغة العربية</h1>
```

### Method 2: Using CSS classes
```html
<div class="arabic-text">النص العربي هنا</div>
<span class="font-tajawal">النص بخط التجوال</span>
```

### Method 3: For entire sections
```html
<section lang="ar">
  <h2>القسم العربي</h2>
  <p>محتوى عربي كامل</p>
</section>
```

## Features

### Automatic RTL Support
Arabic content automatically gets right-to-left direction:
```html
<div lang="ar">
  <!-- Content flows from right to left automatically -->
</div>
```

## AI Chat Support

### ✨ Automatic Arabic Detection
The AI chat widget **automatically detects Arabic text** and applies Tajawal font with RTL direction!

**How it works:**
1. When you type Arabic in the input field, it automatically switches to RTL mode with Tajawal font
2. When you send an Arabic message, it displays with Tajawal font
3. When the AI responds in Arabic, the response also uses Tajawal font

**No manual configuration needed** - just type in Arabic and it works! 🎉

**Example:**
```
You type: مرحبا، كيف حالك؟
AI responds: مرحبًا! أنا بخير، شكرًا لك. كيف يمكنني مساعدتك اليوم؟
```
Both messages will automatically use Tajawal font with proper RTL alignment.

### Manual Usage (if needed)
```html
<div class="nexai-bubble" lang="ar">رسالة عربية</div>
```

### Form Elements
All inputs, textareas, and buttons support Arabic:
```html
<input type="text" placeholder="اكتب هنا" lang="ar">
<button lang="ar">إرسال</button>
```

## Font Weights Available
- 300 (Light)
- 400 (Regular)
- 500 (Medium)
- 700 (Bold)
- 800 (Extra Bold)

## Example Usage

### Mixed Content (English + Arabic)
```html
<div class="mixed-content">
  Welcome - مرحبا
</div>
```

### Pure Arabic Page
```html
<!DOCTYPE html>
<html lang="ar">
<head>
  <!-- All content will use Tajawal font -->
</head>
<body>
  <!-- Arabic content here -->
</body>
</html>
```

## Browser Support
Tajawal is supported in all modern browsers via Google Fonts CDN.

## Files Modified
- ✅ `index.html` - Added Tajawal font import and arabic.css
- ✅ `ai-chat.html` - Added Tajawal font import and arabic.css
- ✅ `dashboard.html` - Added Tajawal font import and arabic.css
- ✅ `account.html` - Added Tajawal font import and arabic.css
- ✅ `auth.html` - Added Tajawal font import and arabic.css
- ✅ All other HTML pages - Updated with Tajawal support
- ✅ `assets/css/arabic.css` - New file with Arabic styling rules

## Testing
To test Arabic font rendering:
1. Open any page in the browser
2. Add `lang="ar"` to any element
3. Insert Arabic text
4. Verify Tajawal font is applied and text flows RTL

---
Last updated: 2026-04-18
