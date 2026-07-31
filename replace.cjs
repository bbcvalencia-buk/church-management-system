const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace pink-600 and pink-50 with muted colors
    content = content.replace(/text-pink-600/g, 'text-[var(--color-text-muted)]');
    content = content.replace(/bg-pink-50/g, 'bg-transparent');

    // Replace blue-600 backgrounds (often buttons or badges)
    content = content.replace(/bg-blue-600/g, 'bg-[var(--color-surface)] text-[var(--color-text-main)] border border-[var(--color-border)]');
    content = content.replace(/hover:bg-blue-700/g, 'hover:bg-[var(--color-surface-hover)]');
    content = content.replace(/text-white/g, 'text-[var(--color-text-main)]');
    
    // Replace borders
    content = content.replace(/border-blue-600/g, 'border-[var(--color-border)]');
    content = content.replace(/text-blue-600/g, 'text-[var(--color-text-main)]');
    content = content.replace(/bg-blue-50/g, 'bg-gray-50');
    
    // Remove shadow classes related to blue
    content = content.replace(/shadow-blue-[^\s"']+/g, '');
    
    // Remove rounded classes for buttons if possible, or just let css handle it
    content = content.replace(/rounded-xl/g, 'rounded-none');
    content = content.replace(/rounded-lg/g, 'rounded-none');
    content = content.replace(/rounded-2xl/g, 'rounded-none');
    content = content.replace(/rounded-md/g, 'rounded-none');
    content = content.replace(/rounded-full/g, 'rounded-none');

    // Fix double text-[var...] if any
    content = content.replace(/text-\[var\(--color-text-main\)\] text-\[var\(--color-text-main\)\]/g, 'text-[var(--color-text-main)]');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated ' + filePath);
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            replaceInFile(fullPath);
        }
    }
}

walk('/Users/millisaequit/Desktop/Church Management System/src');
