"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FileUpload from "@/components/fileUpload";

interface UploadDialogProps {
  closeDialog: () => void;  // Accept closeDialog as a prop
}

const UploadDialog: React.FC<UploadDialogProps> = ({ closeDialog }) => {
  return (
    <Dialog open={true} onOpenChange={closeDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Your Document</DialogTitle>
        </DialogHeader>
        <FileUpload />
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;
