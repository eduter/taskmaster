interface Label {
    id: string;
    name: string;
    color: string;
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
}

interface TaskTemplate {
    summary: string;
    description: string;
    labelIds: string[];
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

export type { Generator, Label, SyncMeta, Task, TaskTemplate };
