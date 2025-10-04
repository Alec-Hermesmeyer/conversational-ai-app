'use client';

import { useState } from 'react';
import { Summary, ActionItem } from '@/types/backend';
import { FileText, Sparkles, CheckSquare, Clock, Tag, Copy, Download, Plus } from 'lucide-react';

interface SummaryPanelProps {
  summaries: Summary[];
  isLoading?: boolean;
  onGenerateSummary?: (type: Summary['type']) => void;
  onExport?: (summaryId: string, format: string) => void;
  className?: string;
}

export function SummaryPanel({
  summaries,
  isLoading = false,
  onGenerateSummary,
  onExport,
  className = ''
}: SummaryPanelProps) {
  const [selectedType, setSelectedType] = useState<Summary['type']>('brief');
  const [activeTab, setActiveTab] = useState<string>(summaries[0]?.id || '');

  const summaryTypes = [
    { key: 'brief' as const, label: 'Brief Summary', icon: FileText },
    { key: 'detailed' as const, label: 'Detailed Summary', icon: FileText },
    { key: 'action_items' as const, label: 'Action Items', icon: CheckSquare },
    { key: 'key_points' as const, label: 'Key Points', icon: Sparkles },
  ];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatActionItem = (item: ActionItem) => (
    <div key={item.id} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
      <div className={`
        w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5
        ${item.completed
          ? 'bg-green-500 border-green-500 text-white'
          : 'border-gray-300 dark:border-gray-600'
        }
      `}>
        {item.completed && <CheckSquare className="w-3 h-3" />}
      </div>
      <div className="flex-1">
        <p className={`text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
          {item.text}
        </p>
        <div className="flex items-center space-x-3 mt-1">
          {item.priority && (
            <span className={`
              inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
              ${item.priority === 'high'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                : item.priority === 'medium'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }
            `}>
              {item.priority}
            </span>
          )}
          {item.dueDate && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {new Date(item.dueDate).toLocaleDateString()}
            </span>
          )}
          {item.assignee && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              @{item.assignee}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const currentSummary = summaries.find(s => s.id === activeTab) || summaries[0];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              AI Summary
            </h3>
          </div>

          {onGenerateSummary && (
            <div className="flex items-center space-x-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as Summary['type'])}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {summaryTypes.map(type => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </select>

              <button
                onClick={() => onGenerateSummary(selectedType)}
                disabled={isLoading}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 text-sm"
              >
                <Plus className="w-3 h-3" />
                <span>Generate</span>
              </button>
            </div>
          )}
        </div>

        {/* Summary Tabs */}
        {summaries.length > 0 && (
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1">
            {summaries.map((summary) => {
              const summaryType = summaryTypes.find(t => t.key === summary.type);
              const Icon = summaryType?.icon || FileText;

              return (
                <button
                  key={summary.id}
                  onClick={() => setActiveTab(summary.id)}
                  className={`
                    flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${activeTab === summary.id
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{summaryType?.label || summary.type}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ) : summaries.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No summaries available yet
            </p>
            {onGenerateSummary && (
              <button
                onClick={() => onGenerateSummary('brief')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Generate Summary
              </button>
            )}
          </div>
        ) : currentSummary ? (
          <div>
            {/* Summary Actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Generated {new Date(currentSummary.createdAt).toLocaleString()}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => copyToClipboard(currentSummary.content)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Copy summary"
                >
                  <Copy className="w-4 h-4" />
                </button>
                {onExport && (
                  <button
                    onClick={() => onExport(currentSummary.id, 'txt')}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Export summary"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Summary Content */}
            <div className="prose dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-gray-900 dark:text-gray-100 leading-relaxed">
                {currentSummary.content}
              </div>
            </div>

            {/* Key Points */}
            {currentSummary.keyPoints.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Key Points
                </h4>
                <ul className="space-y-2">
                  {currentSummary.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items */}
            {currentSummary.actionItems && currentSummary.actionItems.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Action Items
                </h4>
                <div className="space-y-3">
                  {currentSummary.actionItems.map(formatActionItem)}
                </div>
              </div>
            )}

            {/* Tags */}
            {currentSummary.tags.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentSummary.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}