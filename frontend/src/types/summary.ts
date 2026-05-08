export interface Summary {
    key_points: string[];
    action_items: string[];
    decisions: string[];
    main_topics: string[];
    participants?: string[];
}

export interface SummaryResponse {
    summary: Summary;
    raw_summary?: string;
}

export interface ProcessRequest {
    transcript: string;
    custom_prompt?: string;
    metadata?: {
        meeting_title?: string;
        date?: string;
        duration?: number;
    };
}

export interface TemplateSection {
    title: string;
    instruction: string;
    format: 'paragraph' | 'list' | 'string';
    item_format?: string;
    example_item_format?: string;
}

export interface Template {
    name: string;
    description: string;
    sections: TemplateSection[];
}

export interface TemplateInfo {
    id: string;
    name: string;
    description: string;
    is_custom: boolean;
}

export interface TemplateDetails extends TemplateInfo {
    section_titles: string[];
    sections: TemplateSection[];
}
