# User Credentials & Access Levels

## 📊 System Users Overview

### 👨‍💼 User 1: WASIM
**Phone (Username): `8581808501`**
**Email:** `wasim@hindmarble.com`
**Password:** `wasim8581`
**Role:** Staff (Full Access)

#### Access Permissions:
- ✅ Stock Management - View, Add, Edit products
- ✅ Sales - Create invoices, manage orders
- ✅ Customers - View and manage customer details
- ✅ Payments - Track and manage payments
- ✅ Reports - Access all reports and analytics

**Status:** Active & Ready to Use

---

### 👤 User 2: NAWAB
**Email (Username): `nawab@hindmarble.com`**
**Phone:** `9999999999` (Optional)
**Password:** `htm-nawab`
**Role:** Stock Viewer (Limited Access)

#### Access Permissions:
- ✅ Stock Management - View only (can see all products and inventory)
- ❌ Sales - Not accessible
- ❌ Customers - Not accessible
- ❌ Payments - Not accessible
- ❌ Reports - Not accessible

**Status:** Active & Ready to Use

---

## 🔐 Login Instructions

### For WASIM (Full Access):
1. Go to Login page
2. Enter: `8581808501` (phone) or `wasim@hindmarble.com` (email)
3. Password: `wasim8581`
4. Click Login

### For NAWAB (Stock Only):
1. Go to Login page
2. Enter: `nawab@hindmarble.com`
3. Password: `htm-nawab`
4. Click Login

---

## 📝 Technical Details

### Database Model
Both users are stored in MongoDB with the following structure:
```
User {
  name: String
  email: String (unique)
  phone: String (unique)
  passwordHash: String (bcrypt hashed)
  role: String (enum: 'admin', 'staff', 'stock-viewer')
  permissions: {
    canViewStock: Boolean
    canViewSales: Boolean
    canViewCustomers: Boolean
    canViewReports: Boolean
    canViewPayments: Boolean
  }
  isActive: Boolean
  timestamps: Date
}
```

### API Response
When users login, they receive permissions data which frontend can use to control UI visibility:

```json
{
  "ok": true,
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "phone": "phone_number",
    "role": "staff",
    "permissions": {
      "canViewStock": true,
      "canViewSales": true,
      "canViewCustomers": true,
      "canViewReports": true,
      "canViewPayments": true
    }
  }
}
```

---

## 🔧 How to Manage Users

### To add more users:
Use the script: `npm run seed-customers`

### To update user passwords:
Edit the MongoDB directly or create a new user with `npm run seed-customers`

### To change permissions:
Update the `permissions` object in MongoDB for the user

---

## ⚠️ Important Notes

1. **Password Security**: Never share passwords in insecure channels
2. **Active Status**: Both users have `isActive: true` - change to false to disable
3. **Unique Constraints**: Email and phone must be unique per user
4. **Token Expiry**: JWT tokens expire in 24 hours
5. **Login Method**: Users can login with either email or phone number

---

## 🚀 Frontend Integration

To restrict UI elements based on user role, use:

```javascript
// After login, store user.permissions in context/state
if (user.permissions.canViewStock) {
  // Show stock menu items
}

if (user.permissions.canViewSales) {
  // Show sales menu items
}
```

---

**Last Updated:** November 20, 2025
**System:** Hindustan Marble & Tiles Backend
