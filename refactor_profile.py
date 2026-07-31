import re

file_path = "src/views/MemberProfile.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Remove activeTab state and imports
content = content.replace("const [activeTab, setActiveTab] = useState('Overview');\n", "")
content = content.replace("const [activeSection, setActiveSection] = useState<\"bio\" | \"contact\" | \"spiritual\" | \"positions\" | \"family\" | \"faith_promise\">(\"bio\");\n", "")

# 2. View Mode Rewrite
view_mode_old = """    // ======== VIEW MODE UI ========
    if (isViewing) {
        return (
            <div className="max-w-[1200px] mx-auto space-y-6 pb-20 font-sans">
                <ProfileHeader
                    member={member}
                    previewUrl={previewUrl}
                    family={family}
                    canManageProfiles={canManageProfiles}
                    id={id}
                    setIsViewing={setIsViewing}
                    setShowEditRequestModal={setShowEditRequestModal}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                />

                {activeTab === 'Overview' ? (
                    <div className="space-y-6">
                        <PersonalDetailsForm
                            member={member}
                            positions={positions}
                            handleViewMinistryMates={handleViewMinistryMates}
                            formatMinistryCategory={formatMinistryCategory}
                            formatMinistryDepartment={formatMinistryDepartment}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FinancialSummary financials={formData.faithPromiseData.financials} />
                        </div>
                    </div>
                ) : (
                    <ActivityHistory
                        serviceAssignments={serviceAssignments}
                        goodnewsAssignments={goodnewsAssignments}
                        attendanceInsights={attendanceInsights}
                        canManageProfiles={canManageProfiles}
                        hasSystemAccess={hasSystemAccess}
                        member={member}
                        sendingInvite={sendingInvite}
                        handleSendInvite={handleSendInvite}
                    />
                )}

                {showEditRequestModal && (
                    <EditRequestModal
                        editRequestMessage={editRequestMessage}
                        onChange={setEditRequestMessage}
                        submitting={submittingEditRequest}
                        onSubmit={handleRequestEdit}
                        onClose={() => { setShowEditRequestModal(false); setEditRequestMessage(""); }}
                    />
                )}

                {showMinistryMatesModal && (
                    <MinistryMatesModal
                        ministryName={selectedMinistryName}
                        mates={selectedMinistryMates}
                        loading={loadingMates}
                        onClose={() => setShowMinistryMatesModal(false)}
                    />
                )}
            </div>
        );
    }"""

view_mode_new = """    // ======== VIEW MODE UI ========
    if (isViewing) {
        return (
            <div className="max-w-[1200px] mx-auto pb-20 font-sans">
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Sticky Left Sidebar */}
                    <div className="w-full lg:w-80 shrink-0 space-y-6 lg:sticky lg:top-8">
                        <ProfileHeader
                            member={member}
                            previewUrl={previewUrl}
                            family={family}
                            canManageProfiles={canManageProfiles}
                            id={id}
                            setIsViewing={setIsViewing}
                            setShowEditRequestModal={setShowEditRequestModal}
                        />
                    </div>
                    {/* Right Scrolling Pane */}
                    <div className="flex-1 space-y-12 w-full">
                        <div className="card-panel p-8">
                            <PersonalDetailsForm
                                member={member}
                                positions={positions}
                                handleViewMinistryMates={handleViewMinistryMates}
                                formatMinistryCategory={formatMinistryCategory}
                                formatMinistryDepartment={formatMinistryDepartment}
                            />
                        </div>
                        <div className="card-panel p-8">
                            <ActivityHistory
                                serviceAssignments={serviceAssignments}
                                goodnewsAssignments={goodnewsAssignments}
                                attendanceInsights={attendanceInsights}
                                canManageProfiles={canManageProfiles}
                                hasSystemAccess={hasSystemAccess}
                                member={member}
                                sendingInvite={sendingInvite}
                                handleSendInvite={handleSendInvite}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FinancialSummary financials={formData.faithPromiseData.financials} />
                        </div>
                    </div>
                </div>

                {showEditRequestModal && (
                    <EditRequestModal
                        editRequestMessage={editRequestMessage}
                        onChange={setEditRequestMessage}
                        submitting={submittingEditRequest}
                        onSubmit={handleRequestEdit}
                        onClose={() => { setShowEditRequestModal(false); setEditRequestMessage(""); }}
                    />
                )}

                {showMinistryMatesModal && (
                    <MinistryMatesModal
                        ministryName={selectedMinistryName}
                        mates={selectedMinistryMates}
                        loading={loadingMates}
                        onClose={() => setShowMinistryMatesModal(false)}
                    />
                )}
            </div>
        );
    }"""
content = content.replace(view_mode_old, view_mode_new)

# 3. Edit Mode Rewrite
edit_sidebar_old = """            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Sidebar - Navigation & Photo */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Profile Photo Card */}
                    <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-5 text-center transition-all hover:shadow-md">
                        <label className="w-32 h-32 rounded-none bg-gray-50/50 border-[2px] border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group cursor-pointer hover:border-blue-400 hover:bg-gray-50/30 transition-all">
                            {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <Upload size={28} className="text-gray-400 group-hover:text-blue-500 transition-colors" strokeWidth={1.5} />
                            )}
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                <span className="text-xs font-bold text-[var(--color-text-main)] tracking-wide">Change Photo</span>
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        </label>
                        <div className="space-y-1">
                            <p className="text-sm font-extrabold text-[#1e2333]">Profile Photo</p>
                            <p className="text-xs font-medium text-gray-400">Supports JPG, PNG</p>
                        </div>
                    </div>


                    {/* Navigation Menu */}
                    <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-3 space-y-1.5 transition-all hover:shadow-md">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id as any)}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-none text-sm font-bold transition-all ${activeSection === section.id
                                    ? "bg-[var(--color-surface)] text-[var(--color-text-main)] border border-[var(--color-border)] text-[var(--color-text-main)] shadow-md "
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                            >
                                <section.icon size={18} className={activeSection === section.id ? "text-[var(--color-text-main)]" : "text-gray-400"} strokeWidth={activeSection === section.id ? 2.5 : 2} />
                                {section.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-9 bg-white rounded-[24px] shadow-sm border border-gray-100 p-8 min-h-[600px] transition-all hover:shadow-md">
                    <h2 className="text-[18px] font-extrabold text-[#111827] mb-6 pb-6 border-b border-gray-100 flex items-center gap-3">
                        {sections.find((s) => s.id === activeSection)?.icon &&
                            React.createElement(sections.find((s) => s.id === activeSection)!.icon, {
                                size: 24,
                                className: "text-[var(--color-text-main)]",
                                strokeWidth: 2.5
                            })
                        }
                        {sections.find((s) => s.id === activeSection)?.label} Information
                    </h2>
                    <div className="animate-in fade-in duration-300">
                        {activeSection === 'bio' && <BioForm data={formData.member} onChange={(f, v) => updateFormData('member', f, v)} />}
                        {activeSection === 'contact' && <ContactForm data={formData.member} onChange={(f, v) => updateFormData('member', f, v)} />}
                        {activeSection === 'spiritual' && <SpiritualForm data={formData.member} onChange={(f, v) => updateFormData('member', f, v)} />}
                        {activeSection === 'positions' && <PositionsForm data={formData.positionsData} onChange={(f, v) => updateFormData('positionsData', f, v)} />}
                        {activeSection === 'family' && <FamilyForm data={formData.familyData} onChange={(f, v) => updateFormData('familyData', f, v)} />}
                        {activeSection === 'faith_promise' && <FaithPromiseForm data={formData.faithPromiseData} onChange={(f, v) => updateFormData('faithPromiseData', f, v)} />}
                    </div>
                </div>
            </div>"""

edit_sidebar_new = """            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Left Sidebar - Sticky Photo */}
                <div className="w-full lg:w-80 shrink-0 space-y-6 lg:sticky lg:top-8">
                    {/* Profile Photo Card */}
                    <div className="card-panel p-8 flex flex-col items-center gap-5 text-center">
                        <label className="w-32 h-32 rounded-lg bg-gray-50/50 border-[2px] border-dashed border-[var(--color-border)] flex items-center justify-center relative overflow-hidden group cursor-pointer hover:border-[var(--color-primary)] transition-all">
                            {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <Upload size={28} className="text-gray-400 group-hover:text-[var(--color-primary)] transition-colors" strokeWidth={1.5} />
                            )}
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                <span className="text-xs font-bold text-white tracking-wide">Change Photo</span>
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        </label>
                        <div className="space-y-1">
                            <p className="text-sm font-extrabold text-[var(--color-text-main)]">Profile Photo</p>
                            <p className="text-xs font-medium text-[var(--color-text-muted)]">Supports JPG, PNG</p>
                        </div>
                    </div>
                </div>

                {/* Right Scrolling Pane - All Forms */}
                <div className="flex-1 w-full space-y-12">
                    <div className="card-panel p-8">
                        <BioForm data={formData.member} onChange={(f, v) => updateFormData('member', f, v)} />
                    </div>
                    <div className="card-panel p-8">
                        <ContactForm data={formData.member} onChange={(f, v) => updateFormData('member', f, v)} />
                    </div>
                    <div className="card-panel p-8">
                        <SpiritualForm data={formData.member} onChange={(f, v) => updateFormData('member', f, v)} />
                    </div>
                    <div className="card-panel p-8">
                        <PositionsForm data={formData.positionsData} onChange={(f, v) => updateFormData('positionsData', f, v)} />
                    </div>
                    <div className="card-panel p-8">
                        <FamilyForm data={formData.familyData} onChange={(f, v) => updateFormData('familyData', f, v)} />
                    </div>
                    <div className="card-panel p-8">
                        <FaithPromiseForm data={formData.faithPromiseData} onChange={(f, v) => updateFormData('faithPromiseData', f, v)} />
                    </div>
                </div>
            </div>"""
content = content.replace(edit_sidebar_old, edit_sidebar_new)

with open(file_path, "w") as f:
    f.write(content)
