'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { campaignSchema, LEAD_SHEET_OPTIONS, type CampaignFormValues } from '@/lib/validations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function CampaignForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      campaign_name: '',
      service_type: 'Tenant_Reports',
      target_region: 'Canada',
      campaign_goal: 'Get tenant reports',
      campaign_message: '',
      cta_button_text: 'Start Free Screening',
      cta_link: 'https://www.tenantreport.ai',
      tone: 'Warm and educational',
      selected_sheet: 'Tenant Screening Leads',
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (data: CampaignFormValues) => {
      const response = await axios.post('/api/campaigns', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Campaign launched successfully!',
        description: data.message || 'Campaign created and awaiting approval.',
      });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      form.reset();
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) ? error.response?.data?.error : 'Something went wrong';
      toast({
        title: 'Failed to create campaign',
        description: message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => createCampaign.mutate(d))} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign Details</CardTitle>
            <CardDescription>Basic information about your campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="campaign_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. April Tenant Screening Awareness" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="service_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Tenant_Reports">Tenant Reports</SelectItem>
                        <SelectItem value="Smart_Tenant_Subscription">Smart Tenant Subscription</SelectItem>
                        <SelectItem value="Rent_Protection">Rent Promise &amp; Protection</SelectItem>
                        <SelectItem value="Background_Screening">Background Screening</SelectItem>
                        <SelectItem value="Property_Management">Property Management</SelectItem>
                        <SelectItem value="All_Services">All Services</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="target_region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Region</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="North America">North America</SelectItem>
                        <SelectItem value="Global">Global</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="selected_sheet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Sheet (Google Sheets)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAD_SHEET_OPTIONS.map((sheet) => (
                        <SelectItem key={sheet} value={sheet}>{sheet}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Which Google Sheet to pull leads from</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Email Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Content</CardTitle>
            <CardDescription>AI will generate the email based on your inputs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="campaign_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Message / Brief</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what you want to communicate. The AI will craft a professional email from this..."
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Min 10 characters. Be specific about your offer.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="campaign_goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Goal</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Get tenant reports" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Tone</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Warm and educational">Warm and educational</SelectItem>
                      <SelectItem value="Professional and clinical">Professional and clinical</SelectItem>
                      <SelectItem value="Friendly and encouraging">Friendly and encouraging</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* CTA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Call to Action</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cta_button_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Button Text</FormLabel>
                  <FormControl>
                    <Input placeholder="Start Free Screening" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cta_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Button Link (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.tenantreport.ai" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full bg-[#0077b6] hover:bg-[#005f8f] text-white"
          size="lg"
          disabled={createCampaign.isPending}
        >
          {createCampaign.isPending ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Send className="mr-2 h-5 w-5" />
          )}
          {createCampaign.isPending ? 'Launching Campaign...' : 'Launch Campaign'}
        </Button>
      </form>
    </Form>
  );
}
