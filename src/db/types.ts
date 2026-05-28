interface Task {
    id: string;
    summary: string;
    description: string;
    labels: string[];
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
    labels: string[];
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
}

export type { Generator, SyncMeta, Task, TaskTemplate };
