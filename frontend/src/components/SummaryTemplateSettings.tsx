'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, GripVertical, Info } from 'lucide-react';
import { Template, TemplateSection, TemplateInfo, TemplateDetails } from '@/types/summary';

export function SummaryTemplateSettings() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<TemplateDetails | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke('api_list_templates') as TemplateInfo[];
      setTemplates(result);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateNew = () => {
    setEditingTemplate({
      id: '',
      name: '',
      description: '',
      is_custom: true,
      section_titles: [],
      sections: [
        {
          title: 'Summary',
          instruction: 'Provide a concise summary of the meeting.',
          format: 'paragraph',
        }
      ]
    });
    setIsDialogOpen(true);
  };

  const handleEdit = async (templateId: string) => {
    try {
      const details = await invoke('api_get_template_details', { templateId }) as TemplateDetails;
      setEditingTemplate(details);
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch template details:', error);
      toast.error('Failed to load template details');
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await invoke('api_delete_template', { templateId });
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error(`Failed to delete template: ${error}`);
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    if (!editingTemplate.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    if (editingTemplate.sections.length === 0) {
      toast.error('At least one section is required');
      return;
    }

    setIsSaving(true);
    try {
      // Generate an ID if it's new
      const id = editingTemplate.id || editingTemplate.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      const templateData: Template = {
        name: editingTemplate.name,
        description: editingTemplate.description,
        sections: editingTemplate.sections,
      };

      await invoke('api_save_template', { templateId: id, template: templateData });
      toast.success('Template saved');
      setIsDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error(`Failed to save template: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addSection = () => {
    if (!editingTemplate) return;
    const newSection: TemplateSection = {
      title: '',
      instruction: '',
      format: 'paragraph',
    };
    setEditingTemplate({
      ...editingTemplate,
      sections: [...editingTemplate.sections, newSection],
    });
  };

  const removeSection = (index: number) => {
    if (!editingTemplate) return;
    const newSections = [...editingTemplate.sections];
    newSections.splice(index, 1);
    setEditingTemplate({
      ...editingTemplate,
      sections: newSections,
    });
  };

  const updateSection = (index: number, field: keyof TemplateSection, value: any) => {
    if (!editingTemplate) return;
    const newSections = [...editingTemplate.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setEditingTemplate({
      ...editingTemplate,
      sections: newSections,
    });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (!editingTemplate) return;
    const newSections = [...editingTemplate.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    setEditingTemplate({
      ...editingTemplate,
      sections: newSections,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Summary Templates</h3>
          <p className="text-sm text-gray-600">
            Customize how meeting summaries are structured and what information is extracted.
          </p>
        </div>
        <Button onClick={handleCreateNew} size="sm" className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-gray-100" />
            </Card>
          ))
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {template.name}
                      {!template.is_custom && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded border border-blue-100 uppercase tracking-wider">
                          Built-in
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">
                      {template.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto border-t bg-gray-50/50 py-3 px-6 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(template.id)}
                  className="h-8 text-xs"
                >
                  {template.is_custom ? (
                    <><Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit</>
                  ) : (
                    <><Info className="w-3.5 h-3.5 mr-1.5" /> View</>
                  )}
                </Button>
                {template.is_custom && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                    className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>
              {editingTemplate?.is_custom ? (editingTemplate.id ? 'Edit Template' : 'New Template') : 'Template Details'}
            </DialogTitle>
            <DialogDescription>
              Define the structure and LLM instructions for this summary template.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Name</label>
                <Input
                  placeholder="e.g., Quick Recap"
                  value={editingTemplate?.name || ''}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                  disabled={!editingTemplate?.is_custom}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ID (used for filename)</label>
                <Input
                  placeholder="e.g., quick_recap"
                  value={editingTemplate?.id || ''}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, id: e.target.value } : null)}
                  disabled={!!editingTemplate?.id || !editingTemplate?.is_custom}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="A brief description of when to use this template..."
                value={editingTemplate?.description || ''}
                onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, description: e.target.value } : null)}
                disabled={!editingTemplate?.is_custom}
                rows={2}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-semibold text-sm">Sections</h4>
                {editingTemplate?.is_custom && (
                  <Button variant="outline" size="sm" onClick={addSection}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Section
                  </Button>
                )}
              </div>

              {editingTemplate?.sections.map((section, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative group">
                  <div className="flex items-start gap-4">
                    {editingTemplate.is_custom && (
                      <div className="flex flex-col gap-1 mt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0}
                          onClick={() => moveSection(index, 'up')}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === editingTemplate.sections.length - 1}
                          onClick={() => moveSection(index, 'down')}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Section Title</label>
                          <Input
                            placeholder="e.g., Action Items"
                            value={section.title}
                            onChange={(e) => updateSection(index, 'title', e.target.value)}
                            disabled={!editingTemplate.is_custom}
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Format</label>
                          <Select
                            value={section.format}
                            onValueChange={(val) => updateSection(index, 'format', val)}
                            disabled={!editingTemplate.is_custom}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="paragraph">Paragraph</SelectItem>
                              <SelectItem value="list">Bullet List</SelectItem>
                              <SelectItem value="string">Single Line</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">LLM Instructions</label>
                        <Textarea
                          placeholder="Instructions for the AI on what to extract for this section..."
                          value={section.instruction}
                          onChange={(e) => updateSection(index, 'instruction', e.target.value)}
                          disabled={!editingTemplate.is_custom}
                          className="bg-white min-h-[80px]"
                        />
                      </div>

                      {section.format === 'list' && (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Item Format (Optional)</label>
                          <Input
                            placeholder="e.g., [Owner] Task Description"
                            value={section.item_format || ''}
                            onChange={(e) => updateSection(index, 'item_format', e.target.value)}
                            disabled={!editingTemplate.is_custom}
                            className="bg-white font-mono text-xs"
                          />
                          <p className="text-[10px] text-gray-400">Hint for the LLM on how to format each list item.</p>
                        </div>
                      )}
                    </div>

                    {editingTemplate.is_custom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-500 mt-1"
                        onClick={() => removeSection(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {editingTemplate?.sections.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg text-gray-400 text-sm">
                  No sections defined. Click "Add Section" to begin.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {editingTemplate?.is_custom ? 'Cancel' : 'Close'}
            </Button>
            {editingTemplate?.is_custom && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Template'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
