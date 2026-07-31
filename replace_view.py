import re

with open('src/views/MemberProfile.tsx', 'r') as f:
    content = f.read()

# Add imports
imports = """
import ProfileHeader from "../components/MemberProfile/ProfileHeader";
import PersonalDetailsForm from "../components/MemberProfile/PersonalDetailsForm";
import ActivityHistory from "../components/MemberProfile/ActivityHistory";
import FinancialSummary from "../components/MemberProfile/FinancialSummary";
"""

content = content.replace('import BioForm from "../components/members/BioForm";', imports.strip() + '\n\nimport BioForm from "../components/members/BioForm";')

# Replace view UI
pattern = re.compile(r'(    if \(isViewing\) \{.*?\n    \}\n)(?=\n    // ======== EDIT MODE UI ========)', re.DOTALL)

new_view = """    if (isViewing) {
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

content, count = pattern.subn(new_view, content)
print(f"Replaced {count} instances.")

with open('src/views/MemberProfile.tsx', 'w') as f:
    f.write(content)
