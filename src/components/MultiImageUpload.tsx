
import React from 'react';
import ImageUpload from './ImageUpload';
import { Plus } from 'lucide-react';

interface MultiImageUploadProps {
    values: string[];
    onChange: (urls: string[]) => void;
    folder: string;
    label?: string;
    description?: string;
}

const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
    values = [],
    onChange,
    folder,
    label = "Upload Images",
    description
}) => {
    const handleAdd = (url: string) => {
        if (url) {
            onChange([...values, url]);
        }
    };

    const handleUpdate = (index: number, newUrl: string) => {
        if (!newUrl) {
            // Remove
            const newValues = values.filter((_, i) => i !== index);
            onChange(newValues);
        } else {
            // Update (replace)
            const newValues = [...values];
            newValues[index] = newUrl;
            onChange(newValues);
        }
    };

    return (
        <div className="space-y-3">
            {label && <label className="block text-sm font-medium text-[var(--color-text-muted)]">{label}</label>}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Existing Images */}
                {values.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative">
                        <ImageUpload
                            value={url}
                            onChange={(newUrl) => handleUpdate(index, newUrl)}
                            folder={folder}
                            label={`Image ${index + 1}`}
                            className="w-full"
                        />
                    </div>
                ))}

                {/* Add New Button / Uploader */}
                <div className="bg-white/5 border border-white/10 rounded-none p-4 flex flex-col items-center justify-center gap-2 min-h-[160px]">
                    <span className="text-sm font-medium text-[var(--color-text-muted)]">Add Another</span>
                    <ImageUpload
                        value=""
                        onChange={handleAdd}
                        folder={folder}
                        label="" // No inner label
                        className="w-full"
                    />
                </div>
            </div>
            {description && <p className="text-xs text-[var(--color-text-muted)]">{description}</p>}
        </div>
    );
};

export default MultiImageUpload;
