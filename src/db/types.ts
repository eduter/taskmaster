interface Label {
    id: string;
    name: string;
    color: string;
}

/** A lightweight, ordered checklist entry embedded in a task. */
interface ChecklistItem {
    id: string;
    summary: string;
    completed: boolean;
}

/** A checklist entry copied into generated tasks as incomplete. */
interface ChecklistItemTemplate {
    id: string;
    summary: string;
}

interface Task {
    id: string;
    summary: string;
    description: string;
    labelIds: string[];
    date: string;
    sortOrder: number;
    completed: boolean;
    completedAt: number | null;
    createdAt: number;
    updatedAt: number;
    generatorId: string | null;
    parentTaskId: string | null;
    checklistItems: ChecklistItem[];
}

interface TaskTemplate {
    summary: string;
    description: string;
    labelIds: string[];
    checklistItems: ChecklistItemTemplate[];
}

interface Generator {
    id: string;
    name: string;
    rrule: string;
    templates: TaskTemplate[];
    active: boolean;
    lastGeneratedDate: string | null;
    createdAt: number;
    updatedAt: number;
}

interface SyncMeta {
    key: string;
    lastSyncedAt: number;
    lastModifiedAt: number;
    lastBackupDay?: string;
    pushPending?: boolean;
    localChangedAt?: number;
}

export type { ChecklistItem, ChecklistItemTemplate, Generator, Label, SyncMeta, Task, TaskTemplate };
