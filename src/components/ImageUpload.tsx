
import React, { useState, useRef } from 'react';
import { Upload, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { uploadFile, deleteFile } from '@/lib/storage';

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    folder: string;
    label?: string;
    description?: string;
    className?: string; // Allow custom styling
}

const ImageUpload: React.FC<ImageUploadProps> = ({
    value,
    onChange,
    folder,
    label = "Upload Image",
    description = "PNG, JPG up to 5MB",
    className
}) => {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (file.size > 5 * 1024 * 1024) {
            alert("File is too large. Max 5MB.");
            return;
        }

        setUploading(true);
        try {
            // Delete old file if exists (optional cleanup)
            if (value) {
                await deleteFile(value).catch(err => console.warn("Failed to delete old file", err));
            }

            // Upload new file
            const url = await uploadFile(file, folder);
            onChange(url);
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Failed to upload image. Please check your connection.");
        } finally {
            setUploading(false);
            // Reset input so same file can be selected again if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemove = async () => {
        if (!value) return;

        const confirmDelete = window.confirm("Are you sure you want to delete this image?");
        if (!confirmDelete) return;

        setUploading(true);
        try {
            await deleteFile(value);
            onChange(''); // Clear the URL
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Failed to delete image.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className={`space-y-2 ${className || ''}`}>
            {label && <label className="form-label">{label}</label>}

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
                <div className="flex flex-col gap-3.5">
                    {/* Preview Area */}
                    <div className="relative group w-full h-36 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center overflow-hidden transition-colors hover:border-[var(--color-primary)]/50">
                        {uploading ? (
                            <Loader2 className="animate-spin text-[var(--color-primary)]" />
                        ) : value ? (
                            <>
                                <img
                                    src={value}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        // Fallback for broken images
                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Error';
                                    }}
                                />
                                <div className="absolute inset-x-0 top-0 p-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        type="button"
                                        onClick={() => window.open(value, '_blank')}
                                        className="p-1.5 rounded-md bg-black/55 hover:bg-black/70 text-white transition-colors"
                                        title="View Full Size"
                                    >
                                        <ImageIcon size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRemove}
                                        className="p-1.5 rounded-md bg-red-600/75 hover:bg-red-700 text-white transition-colors"
                                        title="Delete Image"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            >
                                <Upload size={22} />
                                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em]">Upload Image</span>
                            </button>
                        )}
                    </div>

                    {/* Info / Controls */}
                    {value ? (
                        <div className="text-sm space-y-1.5">
                            <p className="text-emerald-600 text-[0.8rem] font-semibold uppercase tracking-[0.07em] flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                Image uploaded
                            </p>
                            <p className="text-[0.76rem] leading-5 text-[var(--color-text-muted)] break-all" title={value}>
                                {value.split('/').pop()}
                            </p>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center px-3 py-1.5 rounded-md border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-[0.72rem] font-semibold uppercase tracking-[0.07em] text-[var(--color-primary-dark)] hover:bg-[var(--color-primary)]/15 transition-colors"
                            >
                                Replace Image
                            </button>
                        </div>
                    ) : (
                        <div className="text-sm text-[var(--color-text-muted)] space-y-2">
                            <p className="text-[0.83rem] leading-5">Select an image to upload.</p>
                            {description && <p className="text-[0.76rem] leading-5">{description}</p>}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center px-3 py-1.5 rounded-md border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-[0.72rem] font-semibold uppercase tracking-[0.07em] text-[var(--color-primary-dark)] hover:bg-[var(--color-primary)]/15 transition-colors"
                            >
                                Browse Files
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    );
};

export default ImageUpload;
