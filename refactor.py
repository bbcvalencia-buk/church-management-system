import os
import re

file_path = "src/views/MinistryDirectory.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Define the markers for each section
modals = {
    "AllMembersModal": ("{/* All Members Modal */}", "{/* Manage Group Modal */}"),
    "ManageGroupModal": ("{/* Manage Group Modal */}", "{/* Editing / Assigning Modal */}"),
    "AssignRoleModal": ("{/* Editing / Assigning Modal */}", "{/* Member View Modal */}"),
    "MemberViewModal": ("{/* Member View Modal */}", "{/* Deletion Modal */}")
}

components_code = {}

for name, (start, end) in modals.items():
    start_idx = content.find(start)
    end_idx = content.find(end)
    if start_idx != -1 and end_idx != -1:
        # We also need to extract the `if (condition)` part before the return of the modal,
        # but the comments are inside the JSX tree.
        # It's something like:
        # {/* All Members Modal */}
        # {allMembersOpen && ( ... )}
        modal_content = content[start_idx:end_idx]
        components_code[name] = modal_content
        # Replace the modal content with a component call
        # We will do this manually in the next step to ensure props are passed correctly.

print(f"Extracted {len(components_code)} modals")

# Let's write the refactored files directly by generating them with Python
# Actually, the props needed for each modal are numerous.
# Let's inspect the code for AllMembersModal
all_members = components_code.get("AllMembersModal", "")
print("AllMembersModal length:", len(all_members))
