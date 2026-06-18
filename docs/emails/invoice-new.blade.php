@extends('emails.layout')

@section('content')
    <div class="email-container">
        <div class="email-header"
            style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
            <div style="text-align: center; width: 100%;">
                <img src="https://vgeneralcontractors.com/assets/logo/logo-png.png" alt="{{ $companyData->company_name }}"
                    style="max-height: 80px; margin-bottom: 15px; display: inline-block;">
            </div>
            <h1 style="color: #2c3e50; margin: 0; font-size: 24px;">
                {{ $isInternal ? 'New Invoice Created' : 'Your New Invoice' }}</h1>
        </div>

        <div class="email-body" style="padding: 20px; background-color: #ffffff;">
            @if ($isInternal)
                <p>A new invoice has been created in the system:</p>
            @else
                <p>Dear {{ $invoice->bill_to_name }},</p>
                <p>We hope this email finds you well. Please find attached your new invoice from
                    {{ $companyData->company_name }}.</p>
            @endif

            <div class="invoice-details"
                style="margin: 20px 0; padding: 15px; border: 1px solid #e9ecef; border-radius: 5px; background-color: #f8f9fa;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6; width: 40%;"><strong>Invoice
                                Number:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">{{ $invoice->invoice_number }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>Date:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">
                            {{ \Carbon\Carbon::parse($invoice->invoice_date)->format('F j, Y') }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>Due Date:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">
                            {{ \Carbon\Carbon::parse($invoice->invoice_date)->addDays(30)->format('F j, Y') }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>Amount Due:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">
                            ${{ number_format($invoice->balance_due, 2) }}</td>
                    </tr>
                    @if ($isInternal)
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>Bill To:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">{{ $invoice->bill_to_name }}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>Email:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">
                                {{ $invoice->bill_to_email ?: 'Not provided' }}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>Phone:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">
                                {{ $invoice->bill_to_phone ?: 'Not provided' }}</td>
                        </tr>
                    @endif
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><strong>Status:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">
                            <span
                                style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; background-color: 
                            @if (strtolower($invoice->status) == 'paid') #28a745 
                            @elseif(strtolower($invoice->status) == 'overdue') #dc3545 
                            @elseif(strtolower($invoice->status) == 'pending') #ffc107 
                            @elseif(strtolower($invoice->status) == 'draft') #6c757d 
                            @elseif(strtolower($invoice->status) == 'sent') #17a2b8 
                            @elseif(strtolower($invoice->status) == 'cancelled') #dc3545 
                            @else #6c757d @endif; 
                            color: #fff; text-transform: uppercase;">
                                {{ $invoice->status }}
                            </span>
                        </td>
                    </tr>
                </table>
            </div>

            @if ($invoice->items && count(json_decode($invoice->items, true)) > 0)
                <div class="invoice-items" style="margin: 20px 0;">
                    <h3 style="color: #2c3e50; border-bottom: 1px solid #e9ecef; padding-bottom: 10px;">Invoice Items</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Description
                                </th>
                                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Quantity
                                </th>
                                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Unit Price
                                </th>
                                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach (json_decode($invoice->items, true) as $item)
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">{{ $item['description'] }}
                                    </td>
                                    <td style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">
                                        {{ $item['quantity'] }}</td>
                                    <td style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">
                                        ${{ number_format($item['rate'], 2) }}</td>
                                    <td style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">
                                        ${{ number_format($item['quantity'] * $item['rate'], 2) }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Subtotal:
                                </td>
                                <td style="padding: 10px; text-align: right; font-weight: bold;">
                                    ${{ number_format($invoice->subtotal, 2) }}</td>
                            </tr>
                            @if ($invoice->tax_amount > 0)
                                <tr>
                                    <td colspan="3" style="padding: 10px; text-align: right;">Tax:</td>
                                    <td style="padding: 10px; text-align: right;">
                                        ${{ number_format($invoice->tax_amount, 2) }}</td>
                                </tr>
                            @endif
                            <tr>
                                <td colspan="3"
                                    style="padding: 10px; text-align: right; font-weight: bold; font-size: 16px;">Total:
                                </td>
                                <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 16px;">
                                    ${{ number_format($invoice->balance_due, 2) }}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            @endif

            @if ($invoice->notes)
                <div class="invoice-notes"
                    style="margin: 20px 0; padding: 15px; border: 1px solid #e9ecef; border-radius: 5px; background-color: #f8f9fa;">
                    <h4 style="color: #2c3e50; margin-top: 0;">Notes</h4>
                    <p style="margin-bottom: 0;">{{ $invoice->notes }}</p>
                </div>
            @endif

            @if ($isInternal)
                <div style="margin-top: 20px;">
                    <p>You can view and manage this invoice in the admin dashboard:</p>
                    <a href="{{ url('/invoices') }}"
                        style="display: inline-block; padding: 10px 20px; background-color: #3490dc; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">View
                        in Dashboard</a>
                </div>
            @else
                <div style="margin-top: 20px;">
                    <p>If you have any questions about this invoice, please contact us at:</p>
                    <p>
                        <strong>Email:</strong> {{ $companyData->email }}<br>
                        <strong>Phone:</strong> {{ $companyData->phone }}
                    </p>
                </div>
            @endif
        </div>

        <div class="email-footer"
            style="padding: 20px; background-color: #f8f9fa; text-align: center; font-size: 12px; color: #6c757d; border-radius: 0 0 5px 5px;">
            <p>&copy; {{ date('Y') }} {{ $companyData->company_name }}. All rights reserved.</p>
            <p>{{ $companyData->address }}, {{ $companyData->city }}, {{ $companyData->state }}
                {{ $companyData->zipcode }}</p>
        </div>
    </div>
@endsection
