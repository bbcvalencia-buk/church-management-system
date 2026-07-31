export const getTypeLabel = (type: string) => {
    switch (type) {
        case 'soul_winning': return 'Soul Winning';
        case 'bible_study': return 'Bible Study';
        case 'outreach': return 'Outreach';
        case 'visitation': return 'Visitation';
        default: return type.replace(/_/g, ' ');
    }
};
