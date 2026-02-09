import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"; 
import { Badge } from "../ui/badge"; 

// Define the types for props
type RatingCardProps = {
  disabilityRating: number;
  monthlyCompensation: number;
};

// Benefit qualification thresholds
const benefitQualifications = [
  { threshold: 50, label: "Full VA Healthcare" },
  { threshold: 60, label: "No-cost Healthcare & Caregiver Support" },
  { threshold: 100, label: "Full Disability Benefits (Dental, Commissary)" },
];

const RatingCard: React.FC<RatingCardProps> = ({ disabilityRating, monthlyCompensation }) => {
  return (
    <Card className="bg-gradient-to-t from-gray-100 via-gray-50 to-gray-100 bg-opacity-90 backdrop-blur-md shadow-md">
      <CardHeader>
        <CardTitle>Your Disability Rating</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          {/* Disability Rating */}
          <p className="text-lg font-bold">
            Disability Rating: <span className="text-primary-800">{disabilityRating}%</span>
          </p>
          {/* Monthly Compensation */}
          <p className="text-lg font-bold">
            Monthly Compensation: <span className="text-green-600">${monthlyCompensation.toFixed(2)}</span>
          </p>
        </div>
        
        {/* Benefit Badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          {benefitQualifications.map((benefit) => (
            disabilityRating >= benefit.threshold && (
              <Badge key={benefit.label} className="bg-primary-950 text-white">
                {benefit.label}
              </Badge>
            )
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RatingCard;
