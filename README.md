# Bible Baptist Church Management System

A comprehensive church management solution built with modern web technologies to handle membership tracking, financial records, attendance, and administrative tasks.

## 🚀 Tech Stack
- **Frontend**: React (Vite) + TypeScript
- **Styling**: TailwindCSS (v4)
- **Backend / Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Icons**: Lucide React

## ✨ Key Features

### 1. 👥 Member Management
- Detailed profiles with biographical, contact, and spiritual information.
- **R2 Integration**: Upload profile photos directly to cloud storage.
- **Faith Promise**: Track yearly commitments and progress per member.
- **ID Cards**: Auto-generate printable ID cards with QR codes (PNG export available).

### 2. 💰 Financial Tracking
- Record Tithes, Offerings, Faith Promises, and Pledges.
- **Reports**: Generate A4 Portrait financial statements for printing.
- **Audit Log**: Track changes to financial records.

### 3. 📊 Administration
- **Role Management**: Assign roles (Treasurer, Clerk, Music Minister) to members.
- **Import / Export**: Bulk import/export members and financial records via TSV.
- **Dashboard**: Real-time stats on membership and attendance.

### 4. 📅 Activities & Attendance
- Track attendance for services and Sunday School.
- Manage church activities and auxiliary groups.

## 🛠️ Setup & Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd final-church-management
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env.local` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_key
   
   VITE_R2_ACCOUNT_ID=your_r2_account_id
   VITE_R2_ACCESS_KEY_ID=your_access_key
   VITE_R2_SECRET_ACCESS_KEY=your_secret_key
   VITE_R2_BUCKET_NAME=your_bucket_name
   VITE_R2_PUBLIC_URL=your_public_url
   ```

4. **Initialize Database**
   Run the SQL commands from `schema.sql` in your Supabase SQL Editor.

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📖 Documentation
- [User Guide](./USER_GUIDE.md): Instructions for using the application features.
- [Verification Checklist](./VERIFICATION_CHECKLIST.md): Steps to verify system functionality.

## 🤝 Contribution
Please ensure linting rules are followed before committing.
```bash
npm run lint
```
