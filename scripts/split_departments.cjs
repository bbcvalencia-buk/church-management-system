const fs = require('fs');

let content = fs.readFileSync('src/views/MemberProfile.tsx', 'utf8');
content = content.replace('adult: "Sunday School Adult",', 'adult: "Sunday School Adult",\n    beginners: "Sunday School Beginners Class",');
fs.writeFileSync('src/views/MemberProfile.tsx', content);

let SSContent = fs.readFileSync('src/views/SundaySchool.tsx', 'utf8');
SSContent = SSContent.replace(
    /{ id: 'nursery_kinder_primary', label: 'Nursery\/Toddler & Primary Department', color: '#ff8042' },/g,
    `{ id: 'nursery', label: 'Nursery/Toddler', color: '#ff8042' },
   { id: 'kinder', label: 'Kindergarten', color: '#ffc658' },
   { id: 'primary', label: 'Primary', color: '#8dd1e1' },`
);
SSContent = SSContent.replace(
    /const VISITOR_CARD_DEPARTMENTS = \['nursery_kinder_primary', 'junior'\];/g,
    `const VISITOR_CARD_DEPARTMENTS = ['nursery', 'kinder', 'primary', 'junior'];`
);
SSContent = SSContent.replace(
    /const SOULS_SAVED_DEPARTMENTS = \['beginners', 'nursery_kinder_primary', 'junior'\];/g,
    `const SOULS_SAVED_DEPARTMENTS = ['beginners', 'nursery', 'kinder', 'primary', 'junior'];`
);
fs.writeFileSync('src/views/SundaySchool.tsx', SSContent);

let AnnouncementsContent = fs.readFileSync('src/views/Announcements.tsx', 'utf8');
AnnouncementsContent = AnnouncementsContent.replace(
    /nursery_kinder_primary: "Nursery\/Toddler & Primary Department",/g,
    `nursery: "Nursery/Toddler Department",
   kinder: "Kindergarten Department",
   primary: "Primary Department",`
);
AnnouncementsContent = AnnouncementsContent.replace(
    /const CHILDREN_DEPARTMENTS = new Set\(\["junior", "nursery_kinder_primary"\]\);/g,
    `const CHILDREN_DEPARTMENTS = new Set(["junior", "nursery", "kinder", "primary"]);`
);
fs.writeFileSync('src/views/Announcements.tsx', AnnouncementsContent);

let TypesContent = fs.readFileSync('src/types.ts', 'utf8');
TypesContent = TypesContent.replace(
    /department: 'adult' \| 'beginners' \| 'nursery_kinder_primary' \| 'junior';/g,
    `department: 'adult' | 'beginners' | 'nursery' | 'kinder' | 'primary' | 'junior';`
);
fs.writeFileSync('src/types.ts', TypesContent);

let SSAccessContent = fs.readFileSync('src/lib/sundaySchoolAccess.ts', 'utf8');
SSAccessContent = SSAccessContent.replace(
    /\| "nursery_kinder_primary"/g,
    `| "nursery" | "kinder" | "primary"`
);
SSAccessContent = SSAccessContent.replace(
    /if \(normalized\.includes\("nursery"\) \|\| normalized\.includes\("kinder"\) \|\| normalized\.includes\("primary"\) \|\| normalized\.includes\("toddler"\)\) \{\s*return "nursery_kinder_primary";\s*\}/g,
    `if (normalized.includes("nursery") || normalized.includes("toddler")) return "nursery";
    if (normalized.includes("kinder")) return "kinder";
    if (normalized.includes("primary")) return "primary";`
);
fs.writeFileSync('src/lib/sundaySchoolAccess.ts', SSAccessContent);

console.log('Fixed files successfully!');
