<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Contact Support Request</title>
    <style>
        /* Add styles similar to your other emails (e.g., new-lead.blade.php) */
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 30px;
            border-radius: 10px;
            background-color: #ffffff;
        }

        .header {
            text-align: center;
            margin-bottom: 25px;
        }

        .header img {
            max-width: 180px;
            height: auto;
        }

        .content h2 {
            color: #28a745;
            text-align: center;
            border-bottom: 2px solid #28a745;
            padding-bottom: 10px;
        }

        .details {
            margin-top: 15px;
        }

        .details strong {
            display: inline-block;
            width: 100px;
            color: #555;
        }

        .details p {
            margin: 8px 0;
        }

        .footer {
            margin-top: 25px;
            text-align: center;
            font-size: 14px;
            color: #666666;
        }

        .button {
            display: inline-block;
            padding: 10px 20px;
            margin-top: 15px;
            background-color: #28a745;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }

        a {
            color: #28a745;
            text-decoration: none;
        }

        hr {
            border: none;
            border-top: 1px solid #eee;
            margin: 20px 0;
        }

        .message-box {
            white-space: pre-wrap;
            background-color: #ffffff;
            padding: 15px;
            border: 1px solid #eee;
            border-radius: 4px;
            margin-top: 5px;
        }

        .social-icons {
            margin: 20px 0;
            text-align: center;
        }

        .social-icons a {
            margin: 0 10px;
            display: inline-block;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="header">
            <img src="https://vgeneralcontractors.com/assets/logo/logo3.webp" width="180"
                alt="Logo V General Contractors">
        </div>

        <div class="content">
            <h2>New Contact Support Request</h2>
            <p>A new contact support request has been submitted via the website:</p>

            <div class="details">
                <p><strong>Name:</strong> {{ $contactSupport->first_name }} {{ $contactSupport->last_name }}</p>
                <p><strong>Email:</strong> <a
                        href="mailto:{{ $contactSupport->email }}">{{ $contactSupport->email }}</a>
                </p>
                <p><strong>Phone:</strong> <a href="tel:{{ preg_replace('/[^\d]/', '', $contactSupport->phone) }}">
                        @php
                            $digits = preg_replace('/[^\d]/', '', $contactSupport->phone);
                            if (strlen($digits) === 10) {
                                echo '(' .
                                    substr($digits, 0, 3) .
                                    ') ' .
                                    substr($digits, 3, 3) .
                                    '-' .
                                    substr($digits, 6, 4);
                            } elseif (strlen($digits) === 11 && substr($digits, 0, 1) === '1') {
                                // Manejar números con código de país +1
                                echo '(' .
                                    substr($digits, 1, 3) .
                                    ') ' .
                                    substr($digits, 4, 3) .
                                    '-' .
                                    substr($digits, 7, 4);
                            } else {
                                echo $contactSupport->phone;
                            }
                        @endphp
                    </a>
                </p>
                <p><strong>SMS Consent:</strong> {{ $contactSupport->sms_consent ? 'Yes' : 'No' }}</p>
                <p><strong>Submitted:</strong> {{ $contactSupport->created_at->format('M d, Y H:i A T') }}</p>
                <hr>
                <p><strong>Message:</strong></p>
                <div class="message-box">{{ $contactSupport->message }}</div>
            </div>

            {{-- Optional: Link to admin panel --}}
            {{-- 
            <p style="text-align: center;">
                <a href="{{ route('admin.contacts.show', $contactSupport->id) }}" class="button">View Request in Admin</a>
            </p>
            --}}
        </div>

        <div class="social-icons">
            @if ($companyData->facebook_link)
                <a href="{{ $companyData->facebook_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="30" alt="Facebook">
                </a>
            @endif
            @if ($companyData->instagram_link)
                <a href="{{ $companyData->instagram_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" width="30" alt="Instagram">
                </a>
            @endif
            @if ($companyData->linkedin_link)
                <a href="{{ $companyData->linkedin_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" width="30" alt="LinkedIn">
                </a>
            @endif
            @if ($companyData->twitter_link)
                <a href="{{ $companyData->twitter_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" width="30" alt="Twitter">
                </a>
            @endif
        </div>

        <div class="footer">
            <p>Business Hours:<br>
                Monday to Friday: 9:00 AM - 5:00 PM</p>
            <p style="margin-top: 10px; font-size: 12px;">© {{ date('Y') }} {{ $companyData->company_name }}.
                All rights reserved.</p>
            @if ($companyData->address)
                <p style="font-size: 10px; color: #999;">{{ $companyData->address }}</p>
            @endif

            <div style="margin-top: 5px; font-size: 12px; color: #777;">
                <p style="margin: 3px 0;">
                    @if ($companyData->phone)
                        <span>
                            @php
                                $phone = $companyData->phone ?? '';
                                $digitsOnly = preg_replace('/[^0-9]/', '', $phone);
                                if (strlen($digitsOnly) == 10) {
                                    $formattedPhone =
                                        '(' .
                                        substr($digitsOnly, 0, 3) .
                                        ') ' .
                                        substr($digitsOnly, 3, 3) .
                                        '-' .
                                        substr($digitsOnly, 6);
                                } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                                    $formattedPhone =
                                        '(' .
                                        substr($digitsOnly, 1, 3) .
                                        ') ' .
                                        substr($digitsOnly, 4, 3) .
                                        '-' .
                                        substr($digitsOnly, 7);
                                } else {
                                    $formattedPhone = $phone;
                                }
                                echo $formattedPhone;
                            @endphp
                        </span>

                        @if ($companyData->email)
                            <span style="margin: 0 5px;">|</span>
                        @endif
                    @endif

                    @if ($companyData->email)
                        <a href="mailto:{{ $companyData->email }}"
                            style="color: #666; text-decoration: none;">{{ $companyData->email }}</a>
                    @endif
                </p>
            </div>
        </div>
    </div>
</body>

</html>
