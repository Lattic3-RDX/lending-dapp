"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Zod schema for four independent "amount" fields
const formSchema = z.object({
  amount1: z.number().optional(), // Validation for first amount
  amount2: z.number().optional(), // Validation for second amount
  amount3: z.number().optional(), // Validation for third amount
  amount4: z.number().optional(), // Optional amount for fourth field
});

export default function App() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount1: 0,
      amount2: 0,
      amount3: 0,
      amount4: 0, // Default value for the fourth field
    },
  });

  const [selectedAssets, setSelectedAssets] = useState({
    field1: "RND",
    field2: "RAD",
    field3: "HUD",
    field4: "None", // Initial value for the fourth field
  });

  const [radishAmountReturned, setRadishAmountReturned] = useState(0);
  const [userHasLoan, setUserHasLoan] = useState(true);

  useEffect(() => {
    //here, need to check whether the user already has a loan NFT
  }, []);

  // Function to handle form submission
  function onEstimateLoan(values: z.infer<typeof formSchema>) {
    console.log(values);
    alert("Submitted");
    //Call the backend
    //setRadishAmountReturned
  }

  // Function to handle Deposit Assets
  function onDepositAssets(values: z.infer<typeof formSchema>) {
    console.log(values);
    alert(`Deposited assets. You get Radish.`);
  }

  // If the userHasLoan is true, display different content
  if (userHasLoan) {
    return (
      <div>
        <Navbar />
        <main className="p-4">
          <div className="h-[40rem] flex justify-center items-center px-4">
            <div className="text-4xl mx-auto font-normal text-neutral-600 dark:text-neutral-400">
              <h1>userHasLoan is TRUE</h1>
              <p>This is the alternative content displayed when the userHasLoan is true.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Original content when the userHasLoan is false
  return (
    <div>
      <Navbar />
      <main className="p-4">
        <div className="h-[40rem] flex justify-center items-center px-4">
          <div className="text-4xl mx-auto font-normal text-neutral-600 dark:text-neutral-400">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onEstimateLoan)} className="space-y-8">
                
                {/* First Input Field */}
                <FormField
                  control={form.control}
                  name="amount1" // Field for first amount
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deposit Asset 1</FormLabel>
                      <div className="flex items-center space-x-4">
                        <Select
                          onValueChange={(value) =>
                            setSelectedAssets((prev) => ({
                              ...prev,
                              field1: value,
                            }))
                          }
                          defaultValue={selectedAssets.field1}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Select asset" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RND">RND</SelectItem>
                            <SelectItem value="RAD">RAD</SelectItem>
                            <SelectItem value="HUD">HUD</SelectItem>
                            <SelectItem value="None">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="amount"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} // Parsing string input to number
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Second Input Field */}
                <FormField
                  control={form.control}
                  name="amount2" // Field for second amount
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deposit Asset 2</FormLabel>
                      <div className="flex items-center space-x-4">
                        <Select
                          onValueChange={(value) =>
                            setSelectedAssets((prev) => ({
                              ...prev,
                              field2: value,
                            }))
                          }
                          defaultValue={selectedAssets.field2}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Select asset" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RND">RND</SelectItem>
                            <SelectItem value="RAD">RAD</SelectItem>
                            <SelectItem value="HUD">HUD</SelectItem>
                            <SelectItem value="None">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="amount"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} // Parsing string input to number
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Third Input Field */}
                <FormField
                  control={form.control}
                  name="amount3" // Field for third amount
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deposit Asset 3</FormLabel>
                      <div className="flex items-center space-x-4">
                        <Select
                          onValueChange={(value) =>
                            setSelectedAssets((prev) => ({
                              ...prev,
                              field3: value,
                            }))
                          }
                          defaultValue={selectedAssets.field3}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Select asset" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RND">RND</SelectItem>
                            <SelectItem value="RAD">RAD</SelectItem>
                            <SelectItem value="HUD">HUD</SelectItem>
                            <SelectItem value="None">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="amount"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} // Parsing string input to number
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Estimate Loan Button */}
                <Button type="submit">Estimate Loan</Button>

                {/* Display Radish Return */}
                <div className="mt-4">You will get {radishAmountReturned} Radish.</div>

                {/* New Deposit Assets Button */}
                <Button type="button" onClick={() => onDepositAssets(form.getValues())}>
                  Deposit Assets
                </Button>

              </form>
            </Form>
          </div>
        </div>
      </main>
    </div>
  );
}
