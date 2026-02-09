"use client";

import React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // For the "Review Claim" link
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Card component

// Define the types for claims
type Claim = {
  id: string;
  status: string;
  claimNumber: string;
  date: string;
  isCompleted: boolean;
};

type ClaimsCardProps = {
  claims: Claim[];
};

// Define the columns for the table
const columns: ColumnDef<Claim>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      row.original.isCompleted ? (
        <Badge className="bg-green-500 text-white">Completed</Badge>
      ) : (
        <Badge className="bg-primary-500 text-white">In Process</Badge>
      )
    ),
  },
  {
    accessorKey: "claimNumber",
    header: "Claim Number",
    cell: ({ row }) => <div>{row.getValue("claimNumber")}</div>,
  },
  {
    accessorKey: "date",
    header: ({ column }) => <div>{column.id === "date" ? "Date Submitted/Resolved" : ""}</div>,
    cell: ({ row }) => <div>{row.getValue("date")}</div>,
  },
  {
    id: "review",
    header: "Actions",
    cell: ({ row }) => (
      <Button variant="vaca" asChild>
        <a href={`/claims/${row.original.id}`}>Review Claim</a>
      </Button>
    ),
  },
];

const ClaimsCard: React.FC<ClaimsCardProps> = ({ claims }) => {
  const table = useReactTable({
    data: claims,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card className="shadow-lg bg-white">
      <CardHeader>
        <CardTitle>Claims Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[60vh] overflow-y-auto"> {/* Adjust the height for larger screens */}
          <Table className="border">
            <TableHeader className="bg-gray-100">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center">
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClaimsCard;