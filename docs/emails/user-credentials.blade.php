<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>Welcome to Our Platform!</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
        }

        .details {
            line-height: 1.6;
            color: #333333;
        }

        .credentials {
            background: #e6f9e9;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }

        .highlight {
            color: #28a745;
            font-weight: bold;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="details">
            <h2 style="color: #28a745; text-align: center; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
                Welcome to Our Platform! 🎉
            </h2>

            <p>Hello {{ $user->name }},</p>

            <p>Your account has been created successfully. Here are your login credentials:</p>

            <div class="credentials">
                <p><strong>Username:</strong> {{ $user->username }}</p>
                <p><strong>Email:</strong> {{ $user->email }}</p>
                <p><strong>Temporary Password:</strong> {{ $password }}</p>
            </div>

            <p>For security reasons, we recommend changing your password after your first login.</p>

            <div style="text-align: center; margin-top: 25px;">
                <p>If you have any questions, please don't hesitate to contact us.</p>
            </div>
        </div>

        <div class="footer" style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <a href="https://facebook.com/vgeneralcontractors"
                    style="margin: 0 10px; text-decoration: none; color: #666;">
                    <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="30" alt="Facebook">
                </a>
                <a href="https://instagram.com/vgeneralcontractors"
                    style="margin: 0 10px; text-decoration: none; color: #666;">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" width="30" alt="Instagram">
                </a>
                <a href="https://twitter.com/vgeneralcontractors"
                    style="margin: 0 10px; text-decoration: none; color: #666;">
                    <img src="https://cdn-icons-png.flaticon.com/512/124/124021.png" width="30" alt="Twitter">
                </a>
                <a href="https://linkedin.com/company/vgeneralcontractors"
                    style="margin: 0 10px; text-decoration: none; color: #666;">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" width="30" alt="LinkedIn">
                </a>
            </div>

            <div style="text-align: center; color: #666; font-size: 14px;">
                <p style="margin: 5px 0;">
                    <strong>Address:</strong> {{ $companyData->address }}
                </p>
                <p style="margin: 5px 0;">
                    <strong>Phone:</strong> {{ \App\Helpers\PhoneHelper::format($companyData->phone) }}
                </p>
                <p style="margin: 5px 0;">
                    <strong>Email:</strong> {{ $companyData->email }}
                </p>
                <p style="margin: 5px 0;">
                    <strong>Business Hours:</strong><br>
                    Monday to Friday: 9:00 AM - 5:00 PM
                </p>
            </div>

            <div style="text-align: center; margin-top: 20px;">
                <p style="color: #666; font-size: 12px;">
                    Copyright © {{ date('Y') }} {{ $companyData->company_name }} - All Rights Reserved
                </p>
                <p style="font-size: 10px; color: #999;">{{ $companyData->address ?? '' }}</p>
            </div>

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
