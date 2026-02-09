"use client"

import React, { useState } from 'react';
import  { Input }  from "@/components/ui/input"; 
import  { Textarea }  from "@/components/ui/textarea";
import  { Button }  from "@/components/ui/button";// Update the path based on your project structure
export default function ResearchPage() {
    const [urls, setUrls] = useState<string[]>([]);
    const [namespace, setNamespace] = useState<string>('');
    const [responseMessage, setResponseMessage] = useState<string>('');
    const [successCount, setSuccessCount] = useState<number>(0);
    const [failureCount, setFailureCount] = useState<number>(0);
    const [failedUrls, setFailedUrls] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
  
    const handleUrlChange = (index: number, value: string) => {
      const updatedUrls = [...urls];
      updatedUrls[index] = value;
      setUrls(updatedUrls);
    };
  
    const handleAddUrl = () => {
      setUrls([...urls, '']);
    };
  
    const handleRemoveUrl = (index: number) => {
      const updatedUrls = urls.filter((_, i) => i !== index);
      setUrls(updatedUrls);
    };
  
    const handleSubmit = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/research', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ urls, namespace }),
        });
  
        if (!response.ok) {
          throw new Error('Failed to process URLs');
        }
  
        const data = await response.json();
        setResponseMessage(data.message);
        setSuccessCount(data.successCount);
        setFailureCount(data.failureCount);
        setFailedUrls(data.failedUrls);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
  
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Research URLs</h1>
        
        {/* Namespace Input */}
        <div className="mb-4">
          <label className="block font-medium mb-2">Namespace</label>
          <Input 
            type="text" 
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="w-full"
          />
        </div>
  
        {/* URLs Input */}
        <div className="mb-4">
          <label className="block font-medium mb-2">URLs</label>
          {urls.map((url, index) => (
            <div key={index} className="flex mb-2">
              <Textarea
                value={url}
                onChange={(e) => handleUrlChange(index, e.target.value)}
                className="w-full"
              />
              <Button 
                variant="destructive"
                type="button" 
                onClick={() => handleRemoveUrl(index)}
                className="ml-2"
              >
                Remove
              </Button>
            </div>
          ))}
          <Button 
            variant="default"
            type="button" 
            onClick={handleAddUrl}
            className="mt-2"
          >
            Add URL
          </Button>
        </div>
  
        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          variant="destructive"
          className="mt-4"
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Submit'}
        </Button>
  
        {/* Response Message */}
        {responseMessage && (
          <div className="mt-4 p-2 bg-green-200 text-green-800 rounded">
            {responseMessage}
          </div>
        )}
  
        {/* Display Stats */}
        {successCount > 0 && (
          <div className="mt-4 p-4 bg-primary-100 rounded">
            <h2 className="text-xl font-semibold">Upload Summary</h2>
            <p>Successfully processed URLs: {successCount}</p>
            <p>Failed URLs: {failureCount}</p>
  
            {failedUrls.length > 0 && (
              <div className="mt-2">
                <h3 className="font-medium">Failed URLs:</h3>
                <ul className="list-disc list-inside">
                  {failedUrls.map((url, index) => (
                    <li key={index}>{url}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
  
        {/* Error Message */}
        {error && (
          <div className="mt-4 p-2 bg-red-200 text-red-800 rounded">
            {error}
          </div>
        )}
      </div>
    );
  }