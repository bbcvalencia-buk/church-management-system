import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Member } from '@/types';
import { Shield, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

const MemberIDPrint: React.FC = () => {
    const { id } = useParams();
    const [member, setMember] = useState<Member | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        const fetchMember = async () => {
            if (!id) return;
            const { data, error } = await supabase
                .from('members')
                .select('*')
                .eq('id', id)
                .single();

            if (error) console.error(error);
            else setMember(data);
            setLoading(false);
        };
        fetchMember();
    }, [id]);

    const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    };

    const handleDownload = async () => {
        if (!member) return;
        setGenerating(true);

        try {
            // CR80 card at 300 DPI: 2.125in x 3.375in = 638 x 1013 px
            const scale = 3;
            const cardW = 204 * scale; // ~612
            const cardH = 324 * scale; // ~972
            const canvas = document.createElement('canvas');
            canvas.width = cardW;
            canvas.height = cardH;
            const ctx = canvas.getContext('2d')!;

            // ── Background ──
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cardW, cardH);

            // Top blue header (1/3 of card)
            const headerH = cardH * 0.33;
            const gradient = ctx.createLinearGradient(0, 0, 0, headerH);
            gradient.addColorStop(0, '#1e3a5f');
            gradient.addColorStop(1, '#1e40af');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, cardW, headerH);

            // Decorative circle (subtle)
            ctx.beginPath();
            ctx.arc(cardW / 2, cardH / 2, 72 * scale, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 20 * scale;
            ctx.stroke();

            // ── Logo Circle ──
            const logoRadius = 15 * scale;
            const logoCenterY = 20 * scale;
            ctx.beginPath();
            ctx.arc(cardW / 2, logoCenterY, logoRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#facc15'; // yellow-400
            ctx.lineWidth = 2 * scale;
            ctx.stroke();

            // Shield icon text placeholder (simple cross)
            ctx.fillStyle = '#1e3a5f';
            ctx.font = `bold ${12 * scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✝', cardW / 2, logoCenterY);

            // ── Church Name ──
            const churchNameY = logoCenterY + logoRadius + 8 * scale;
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${9 * scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic'; // Reset to default
            ctx.fillText('BIBLE BAPTIST CHURCH', cardW / 2, churchNameY);

            ctx.fillStyle = '#93c5fd'; // blue-200
            ctx.font = `${7 * scale}px Arial`;
            ctx.fillText('VALENCIA CITY', cardW / 2, churchNameY + 12 * scale);

            // ── Profile Photo ──
            const photoRadius = 36 * scale;
            const photoCenterY = headerH + 10 * scale;

            // White border circle
            ctx.beginPath();
            ctx.arc(cardW / 2, photoCenterY, photoRadius + 4 * scale, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.shadowColor = 'rgba(0,0,0,0.15)';
            ctx.shadowBlur = 8 * scale;
            ctx.shadowOffsetY = 2 * scale;
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            if (member.profile_picture_url) {
                try {
                    const img = await loadImage(member.profile_picture_url);
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cardW / 2, photoCenterY, photoRadius, 0, Math.PI * 2);
                    ctx.clip();

                    // Maintain aspect ratio and cover
                    const imgAspect = img.width / img.height;
                    let drawW = photoRadius * 2;
                    let drawH = photoRadius * 2;

                    if (imgAspect > 1) {
                        drawW = drawH * imgAspect;
                    } else {
                        drawH = drawW / imgAspect;
                    }

                    ctx.drawImage(
                        img,
                        cardW / 2 - drawW / 2,
                        photoCenterY - drawH / 2,
                        drawW,
                        drawH
                    );
                    ctx.restore();
                } catch {
                    ctx.beginPath();
                    ctx.arc(cardW / 2, photoCenterY, photoRadius, 0, Math.PI * 2);
                    ctx.fillStyle = '#f3f4f6';
                    ctx.fill();
                    ctx.fillStyle = '#9ca3af';
                    ctx.font = `${8 * scale}px Arial`;
                    ctx.fillText('NO PHOTO', cardW / 2, photoCenterY);
                }
            } else {
                ctx.beginPath();
                ctx.arc(cardW / 2, photoCenterY, photoRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#f3f4f6';
                ctx.fill();
                ctx.fillStyle = '#9ca3af';
                ctx.font = `${8 * scale}px Arial`;
                ctx.fillText('NO PHOTO', cardW / 2, photoCenterY);
            }

            // ── Member Name ──
            const nameY = photoCenterY + photoRadius + 20 * scale;
            ctx.fillStyle = '#1e3a5f';
            ctx.font = `bold ${11 * scale}px Arial`;
            ctx.textAlign = 'center';

            const fullName = `${member.first_name} ${member.surname}`.toUpperCase();
            ctx.fillText(fullName, cardW / 2, nameY);

            // Yellow divider
            const dividerY = nameY + 8 * scale;
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.roundRect(cardW / 2 - 12 * scale, dividerY, 24 * scale, 2 * scale, 1 * scale);
            ctx.fill();

            // Role
            const roleY = dividerY + 12 * scale;
            ctx.fillStyle = '#6b7280';
            ctx.font = `bold ${8 * scale}px Arial`;
            const role = member.is_pastor ? 'PASTOR' : member.is_pastors_wife ? "PASTOR'S WIFE" : 'MEMBER';
            ctx.fillText(role, cardW / 2, roleY);

            // ── Footer ──
            const footerY = cardH - 25 * scale;

            // Thin line
            ctx.strokeStyle = '#f3f4f6';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(16 * scale, footerY - 8 * scale);
            ctx.lineTo(cardW - 16 * scale, footerY - 8 * scale);
            ctx.stroke();

            // ID Number (left)
            ctx.textAlign = 'left';
            ctx.fillStyle = '#9ca3af';
            ctx.font = `bold ${6 * scale}px Arial`;
            ctx.fillText('ID NUMBER', 16 * scale, footerY);
            ctx.fillStyle = '#1f2937';
            ctx.font = `bold ${10 * scale}px monospace`;
            const idNum = member.member_number || (member.id_number ?? 0).toString().padStart(4, '0');
            ctx.fillText(idNum, 16 * scale, footerY + 12 * scale);

            // Joined (right)
            ctx.textAlign = 'right';
            ctx.fillStyle = '#9ca3af';
            ctx.font = `bold ${6 * scale}px Arial`;
            ctx.fillText('JOINED', cardW - 16 * scale, footerY);
            ctx.fillStyle = '#1f2937';
            ctx.font = `bold ${9 * scale}px Arial`;
            const joinedYear = member.membership_date ? new Date(member.membership_date).getFullYear().toString() : 'N/A';
            ctx.fillText(joinedYear, cardW - 16 * scale, footerY + 12 * scale);

            // ── jsPDF Generation ──
            const data = canvas.toDataURL('image/png');

            // Create PDF with CR80 dimensions in inches (2.125 x 3.375)
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'in',
                format: [2.125, 3.375]
            });

            pdf.addImage(data, 'PNG', 0, 0, 2.125, 3.375);
            pdf.save(`MemberID-${member.surname}-${idNum}.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF: " + (error as Error).message);
        } finally {
            setGenerating(false);
        }
    };

    if (loading) return <div className="text-white p-8 text-center">Loading ID Card...</div>;
    if (!member) return <div className="text-white p-8 text-center">Member not found.</div>;

    return (
        <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-8">
            <div className="mb-8 text-center space-y-4">
                <h1 className="text-2xl font-bold text-[var(--color-text-main)]">Member ID Card Preview</h1>
                <div className="flex justify-center gap-4">
                    <button
                        onClick={handleDownload}
                        disabled={generating}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
                    >
                        <Download size={18} /> {generating ? 'Generating PDF...' : 'Download PDF'}
                    </button>
                </div>
                <p className="text-[var(--color-text-muted)] text-sm">Click "Download PDF" to save the ID card PDF.</p>
            </div>

            {/* ID Card Visual Preview */}
            <div
                className="w-[54mm] h-[86mm] bg-white text-black relative overflow-hidden shadow-2xl flex flex-col items-center text-center"
                style={{
                    fontFamily: 'Inter, sans-serif',
                    boxSizing: 'border-box'
                }}
            >
                {/* Background Design */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-0 w-full h-1/3" style={{ background: 'linear-gradient(to bottom, #1e3a5f, #1e40af)' }}></div>
                    <div className="absolute bottom-0 w-full h-12 bg-yellow-400/10 skew-y-6 translate-y-6"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-[20px] border-white/5 rounded-full"></div>
                </div>

                {/* Content Layer */}
                <div className="relative z-10 flex flex-col items-center h-full w-full p-4">

                    {/* Header Logo */}
                    <div className="mt-1 mb-3 flex flex-col items-center">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border-2 border-yellow-400 shadow-sm mb-1">
                            <Shield className="text-blue-900" size={20} />
                        </div>
                        <h2 className="text-[9px] uppercase tracking-wider font-bold text-white leading-tight">Bible Baptist Church</h2>
                        <p className="text-[7px] text-blue-200 uppercase tracking-widest mt-0.5">Valencia City</p>
                    </div>

                    {/* Photo */}
                    <div className="w-24 h-24 bg-gray-200 rounded-full border-4 border-white shadow-md overflow-hidden mb-3">
                        {member.profile_picture_url ? (
                            <img
                                src={member.profile_picture_url}
                                className="w-full h-full object-cover"
                                alt="Profile"
                                crossOrigin="anonymous"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-[8px] uppercase">
                                No Photo
                            </div>
                        )}
                    </div>

                    {/* Name */}
                    <div className="mb-auto w-full">
                        <h1 className="text-sm font-bold text-blue-900 uppercase leading-tight break-words">
                            {member.first_name} {member.surname}
                        </h1>
                        <div className="h-0.5 w-8 bg-yellow-400 mx-auto my-1.5 rounded-full"></div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                            {member.is_pastor ? 'Pastor' : member.is_pastors_wife ? "Pastor's Wife" : 'Member'}
                        </p>
                    </div>

                    {/* Metadata Footer */}
                    <div className="w-full pt-2 border-t border-gray-100 flex justify-between items-end mt-2">
                        <div className="text-left">
                            <p className="text-[6px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">ID Number</p>
                            <p className="text-xs font-mono font-bold text-gray-800 tracking-tighter">
                                {member.member_number || (member.id_number ?? 0).toString().padStart(4, '0')}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[6px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Joined</p>
                            <p className="text-[9px] font-bold text-gray-800">
                                {member.membership_date ? new Date(member.membership_date).getFullYear() : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemberIDPrint;
