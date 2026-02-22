# User Guide — Bible Baptist Church Management System

## 1. Member Management

### 1.1 Adding a New Member
1. Navigate to **Members** -> **Add Member**.
2. Fill in the required fields (First Name, Surname, Date of Birth).
3. **Upload Profile Picture**: Click the camera icon or upload area. This saves directly to cloud storage.
4. **Faith Promise**: Once the member is created, go to the **Faith Promise** tab in their profile to add a yearly commitment.

### 1.2 Printing ID Cards
1. Open a **Member Profile**.
2. Click the **Print ID** button in the top right.
3. You will see a preview of the ID card (Portrait format).
4. **Download PNG**: Click to save the ID card as an image file (e.g., for sending to a printing service).
5. **Print**: Click to print directly. Ensure your printer settings are set to **Portrait** and **Scale: 100%**.

---

## 2. Financial Management

### 2.1 Recording Transactions
1. Go to **Financials** -> **New Record**.
2. Select the **Member**.
3. Choose the transaction type (Tithe, Faith Promise, Love Gift, etc.).
4. Enter the amount and save.
   * *Note: Faith Promise entries automatically update the member's progress bar in their profile.*

### 2.2 Printing Financial Reports
1. Go to **Financials** -> **Reports**.
2. Select the **Year** and optionally filter by a specific **Member**.
3. Click **Print Statements**.
4. The system generates a clean, **A4 Portrait** formatted report suitable for distribution.

---

## 3. Data Import / Export

### 3.1 Importing Data
1. Go to **Import / Export** in the sidebar.
2. Select the category (**Members** or **Financial Records**).
3. **Download Template**: Get the correct `.tsv` file format.
4. Open the template in Excel or Google Sheets, fill in your data, and **File -> Download as TSV** (Tab Separated Values).
5. Upload the TSV file to the system and click **Import**.

### 3.2 Exporting Data
1. Go to **Import / Export**.
2. Click **Download Current Data**.
3. This provides a backup of your data in TSV format.

---

## 4. Administrative Tools

### 4.1 Role Management
1. Go to **Role Management** (Sidebar).
2. Search for a member by name.
3. Toggle the roles (e.g., **Treasurer**, **Clerk**) to grant them access rights.
   * *Note: Currently, this requires the `user_roles` table to be created in the database.*

### 4.2 File Attachments (Cloud Storage)
- **Members**: Profile photos and documents are stored in the `profiles/` folder in your R2 bucket.
- **Visitors**: Visitor card scans are stored in `visitors/`.
- **Activities**: Sketches and event photos are stored in `sketches/`.
- **Deleting** a record automatically deletes the associated files from the cloud to save space.

---

## 5. Sunday School — Teacher's Guide

> **Who can access this section?**
> Only accounts with the **Sunday School Admin** role (or Super Admin) can view and file reports under the **Sunday School** module. Contact your church administrator to have this role assigned to your account.

---

### 5.1 Logging In

1. Open the system in your browser and go to the **Login** page.
2. Enter your **Email Address** and **Password** provided by the administrator.
3. Click **SIGN IN SECURELY**.
4. Once logged in, you will be automatically redirected to the **Sunday School Overview** dashboard.
5. If you do not see the **Sunday School** link in the sidebar, your account may not have the correct role — contact your administrator.

---

### 5.2 Understanding the Dashboard

When you open the Sunday School module, you will see three summary cards at the top:

| Card | What It Shows |
|---|---|
| **Total Attendance Today** | Sum of all department attendees for the most recent session date |
| **New Visitors** | Number of visitors recorded for the most recent session date |
| **Souls Saved** | Total souls saved across all departments for the most recent date |

Below the cards is the **Recent Reports** table listing all past sessions, sorted newest first. You can search by department name using the search box on the right.

---

### 5.3 Filing a New Session Report

After every Sunday School session, each department teacher (or designated recorder) must file a report. Here is how:

1. Click the blue **"File Report"** button (top-right corner of the page).
2. A form will open. Fill it in following the steps below:

**Step 1 — Set the Date and Department**
- **Date**: Automatically set to the most recent Sunday. Change it only if filing for a past session.
- **Department**: Choose the one you are reporting for:
  - `Adult Department`
  - `Beginners`
  - `Nursery / Kinder / Toddler`
  - `Junior Department`

**Step 2 — Mark Member Attendance**
- A searchable list of all registered members appears under **"Members Present"**.
- Check the box next to each member who was present in your class.
- Use the **search box** to quickly find a member by name.
- The system automatically distinguishes between regular members and visitor-members.

**Step 3 — Record Visitors / Non-Members**
- In the **"Visitors / Non-Members Present"** number field, type the total count of walk-in visitors who are **not yet registered** in the system.
- The **Total** display updates automatically: `Checked Members + Visitor Count`.

**Step 4 — Visitor Cards** *(Nursery/Kinder/Toddler and Junior departments only)*
- These two departments have an extra section for visitor tracking:
  - **Visitor Card Image Upload**: Take a photo of the physical visitor card and upload it here (JPG or PNG).
  - **Quick Visitor Registration**: Encode visitor details directly into the system — Name, Address, and Contact Number are required. Click **"+ Add Visitor"** to add more entries.
- Encoded visitors are automatically saved as visitor records linked to this session.

**Step 5 — Souls Saved** *(Beginners, Nursery/Kinder/Toddler, and Junior only)*
- If your department is one of these three, a **Souls Saved** field will appear.
- Enter the number of individuals who accepted Christ during your session.

3. When everything is filled in, click **"Submit Report"**.
4. A success message will confirm the report has been saved. It will now appear in the Recent Reports table.

---

### 5.4 Department Quick Reference

| Department | Mark Members | Count Visitors | Upload Visitor Card | Encode Visitor Info | Record Souls Saved |
|---|:---:|:---:|:---:|:---:|:---:|
| Adult | ✅ | ✅ | ❌ | ❌ | ❌ |
| Beginners | ✅ | ✅ | ❌ | ❌ | ✅ |
| Nursery / Kinder / Toddler | ✅ | ✅ | ✅ | ✅ | ✅ |
| Junior | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 5.5 Editing a Past Report

1. In the **Recent Reports** table, find the session you want to correct.
2. Click the **eye (👁)** or **pencil (✏️)** icon on that row.
3. The form reopens pre-filled with the saved data.
4. Make your changes (attendance list, visitor count, souls saved, etc.).
5. Click **"Save Changes"** to update the record.

> ⚠️ **Note:** Editing a report **replaces** the previous attendance list. Members left unchecked will be removed from the attendance log for that session.

---

### 5.6 Deleting a Report

1. Open the report using the edit/view button (see 5.5 above).
2. Click the red **"Delete"** button at the bottom-left of the form.
3. Confirm by clicking **"Delete Record"** in the prompt.

> ⚠️ **Warning:** Deletion is **permanent** and will remove all linked attendance logs and visitor records associated with that session.

---

### 5.7 Tips and Reminders

- **File your report on the same Sunday** as the session while attendance details are fresh.
- If a member was **absent**, simply leave them unchecked — no additional action is needed.
- For the **Adult Department**, the visitor number field is the only way to record non-member attendance. Make sure to enter the correct count.
- If you encode a visitor who already exists in the system (matched by name, contact, or birthday), the system will **automatically link** them to avoid duplicate records.
- All uploaded visitor card images are stored securely in the cloud under `sunday-school/[department]/`.

---

## 6. Good News Class — Teacher's Guide

> **Who can access this section?**
> Only accounts with the **Activity Coordinator** role (or Super Admin) can access the **Activities & Missions** module where Good News Class records are filed. Contact your church administrator to have this role assigned to your account.

---

### 6.1 Logging In

1. Go to the system login page in your browser.
2. Enter your **Email Address** and **Password** given by the administrator.
3. Click **SIGN IN SECURELY**.
4. You will be redirected automatically to the **Activities & Missions** section.
5. If the **Activities** link does not appear in the sidebar, your account is missing the correct role — inform your administrator.

---

### 6.2 Understanding the Activities Dashboard

The **Activities & Missions** page shows a card grid of all recorded activities (Good News Class, Soul Winning, Bible Study, Outreach). Each card displays:

- **Type** of activity (e.g., Good News Class)
- **Date** of the activity
- **Location / Area** (if filled in)
- **Total Attendance** and **Souls Saved** summary

Click any card to open the full **Detail View** with statistics and any uploaded attachments.

---

### 6.3 Filing a New Good News Class Report

After every Good News Class session, file a report in the system:

1. Click the **"+ Add Activity"** button (top-right corner of the page).
2. The report form will open. Fill in each section:

**Step 1 — Type and Date**
- **Type**: Select **"Good News Class"** from the dropdown.
- **Date**: Defaults to the most recent Sunday. Change it if filing for a different date.

**Step 2 — Location / Area**
- Enter the area or location where the class was held (e.g., *Purok 5, Bagontaas*).
- This field is optional but helps track where classes are being conducted.

**Step 3 — Kids Attended**
- This field appears **only for Good News Class**.
- Enter the number of children who attended the session.
- This count is added to the member count for the **Total Attendance**.

**Step 4 — Souls Saved**
- Enter the number of children or individuals who accepted Christ during the class.
- Leave as `0` if none.

**Step 5 — Non-Member Attendees**
- Enter the number of any other non-member adults or guardians present who are not in the system.
- The **Total Attendance** is automatically computed as: `Members Marked + Kids Attended + Non-Member Count`.

**Step 6 — Facebook Post Link** *(Optional)*
- If your activity was posted on the church Facebook page, paste the post URL here.
- This will appear as a clickable link in the detail view.

**Step 7 — Attachment / Sketch** *(Optional)*
- Upload a photo or document related to the class (e.g., group photo, sketch map, printed material).
- Accepted formats: **PNG, JPG, PDF** (max 10MB).
- Files are stored securely in the cloud under the `sketches/` folder.

**Step 8 — Mark Member Attendance**
- A searchable list of church members appears at the bottom of the form under **"Mark Attendance"**.
- Check the box for each **church member (teacher/worker)** who participated in conducting the class.
- This logs their personal attendance for reporting purposes.

3. Click **"Submit Report"** when done.
4. A success confirmation will appear and the record will be added to the activity grid.

---

### 6.4 Viewing a Record's Full Details

1. Click on any activity card in the grid.
2. A full-screen detail panel will open showing:
   - Activity type, date, location
   - Attached photo or document (if uploaded)
   - Facebook link (if provided)
   - **Non-Member Attendance**, **Total Attendance**, and **Souls Saved** stats
3. From this panel, you can also **Edit** (✏️) or **Delete** (🗑) the record.

---

### 6.5 Editing a Past Record

1. Open the activity card by clicking it (Detail View), then click the **pencil (✏️)** icon in the top-right.
   - *Alternatively*, click the pencil icon that appears when you hover over a card directly.
2. The form reopens with all saved data.
3. Make your corrections and click **"Save Changes"**.

> ⚠️ **Note:** Editing a report **replaces** the previous attendance list. Members left unchecked will be removed from the attendance log for that activity.

---

### 6.6 Deleting a Record

1. Open the activity card (Detail View).
2. Click the **trash (🗑)** icon in the top-right of the detail panel.
   - *Alternatively*, hover over any card in the grid to reveal a delete icon at the top-right.
3. Confirm by clicking **"Delete Record"** in the confirmation prompt.

> ⚠️ **Warning:** Deletion is **permanent** and will also remove all linked attendance logs and any uploaded file from cloud storage.

---

### 6.7 Tips and Reminders

- **Good News Class is the only activity type** with a dedicated **Kids Attended** field. Other types (Soul Winning, Bible Study, Outreach) use **Tracts Distributed** instead.
- The **Total Attendance** shown on the card = Members checked + Kids Attended + Non-Member count. Make sure all three are filled correctly.
- **File your report on the same day** as the class while the attendance count is still accurate.
- If a church member helped conduct the class, make sure to **check their name** in the attendance picker — this tracks worker participation records.
- For Good News Classes held in different areas, always fill in the **Location / Area** field so reports can be filtered and analyzed by location later.


