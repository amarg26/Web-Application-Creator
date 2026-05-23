import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Question } from "@/lib/revision";
import { cn } from "@/lib/utils";

const SUGGESTED_TAGS = ["DP", "Graph", "Trees", "Sliding Window", "Binary Search", "Backtracking", "Greedy", "Heap", "Stack", "Two Pointers", "Sorting", "Trie", "Bit Manipulation", "Math"];

const formSchema = z.object({
  name: z.string().min(1, "Question name is required"),
  platform: z.enum(["LeetCode", "GFG", "Codeforces", "Other"]),
  tags: z.array(z.string()).min(1, "At least one tag is required"),
  approach: z.string(),
  timeComplexity: z.string(),
  confidence: z.coerce.number().min(1).max(5),
  lastRevisedDate: z.string(),
  mistakeNotes: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface QuestionFormProps {
  initialData?: Question;
  onSubmit: (data: Omit<Question, "id" | "createdAt">) => void;
  isSubmitting?: boolean;
}

export function QuestionForm({ initialData, onSubmit, isSubmitting }: QuestionFormProps) {
  const [tagInput, setTagInput] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      platform: initialData?.platform || "LeetCode",
      tags: initialData?.tags || [],
      approach: initialData?.approach || "",
      timeComplexity: initialData?.timeComplexity || "O(N)",
      confidence: initialData?.confidence || 3,
      lastRevisedDate: initialData?.lastRevisedDate || new Date().toISOString(),
      mistakeNotes: initialData?.mistakeNotes || "",
    },
  });

  const handleTagAdd = (tag: string) => {
    const currentTags = form.getValues("tags");
    if (tag && !currentTags.includes(tag)) {
      form.setValue("tags", [...currentTags, tag], { shouldValidate: true });
    }
    setTagInput("");
  };

  const handleTagRemove = (tagToRemove: string) => {
    const currentTags = form.getValues("tags");
    form.setValue("tags", currentTags.filter(t => t !== tagToRemove), { shouldValidate: true });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="question-form">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="col-span-1 md:col-span-2">
                <FormLabel>Question Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Two Sum" {...field} data-testid="input-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="platform"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Platform</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-platform">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="LeetCode">LeetCode</SelectItem>
                    <SelectItem value="GFG">GeeksForGeeks</SelectItem>
                    <SelectItem value="Codeforces">Codeforces</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confidence"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confidence Level</FormLabel>
                <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={field.value.toString()}>
                  <FormControl>
                    <SelectTrigger data-testid="select-confidence">
                      <SelectValue placeholder="Select confidence" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 - Very Weak (Revise in 2 days)</SelectItem>
                    <SelectItem value="2">2 - Weak (Revise in 3 days)</SelectItem>
                    <SelectItem value="3">3 - Medium (Revise in 5 days)</SelectItem>
                    <SelectItem value="4">4 - Strong (Revise in 7 days)</SelectItem>
                    <SelectItem value="5">5 - Expert (Revise in 10 days)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem className="col-span-1 md:col-span-2">
                <FormLabel>Topic Tags</FormLabel>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Type a tag and press enter..." 
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleTagAdd(tagInput.trim());
                        }
                      }}
                      data-testid="input-tag"
                    />
                    <Button type="button" variant="secondary" onClick={() => handleTagAdd(tagInput.trim())}>Add</Button>
                  </div>
                  
                  {field.value.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-md min-h-[50px] bg-muted/20">
                      {field.value.map(tag => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1 bg-secondary/50 hover:bg-secondary">
                          {tag}
                          <button type="button" onClick={() => handleTagRemove(tag)} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="mt-2">
                    <FormDescription className="mb-2">Suggested tags:</FormDescription>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_TAGS.map(tag => (
                        <Badge 
                          key={tag} 
                          variant="outline" 
                          className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors text-[10px]"
                          onClick={() => handleTagAdd(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timeComplexity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time Complexity</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. O(N log N)" {...field} className="font-mono" data-testid="input-tc" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastRevisedDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Revised Date</FormLabel>
                <FormControl>
                  {/* Using native date input to avoid complex popover setup */}
                  <Input 
                    type="date" 
                    value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        field.onChange(new Date(e.target.value).toISOString());
                      }
                    }}
                    data-testid="input-date"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="approach"
            render={({ field }) => (
              <FormItem className="col-span-1 md:col-span-2">
                <FormLabel>Approach / Intuition</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Briefly describe the intuition behind the solution..." 
                    className="min-h-[100px] font-mono text-sm" 
                    {...field} 
                    data-testid="textarea-approach"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mistakeNotes"
            render={({ field }) => (
              <FormItem className="col-span-1 md:col-span-2">
                <FormLabel>Mistakes / Edge Cases</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="What did you mess up? What edge cases to remember?" 
                    className="min-h-[100px] font-mono text-sm border-red-500/20 focus-visible:ring-red-500/30" 
                    {...field} 
                    data-testid="textarea-mistakes"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-border/50">
          <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
            {initialData ? "Update Question" : "Add Question"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
