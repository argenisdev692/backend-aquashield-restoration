<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>🔔 Notificación Admin: Rechazo de Cita - V General Contractors</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333333;
        }

        .container {
            max-width: 650px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .header {
            background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            margin: -30px -30px 20px;
            padding: 25px 30px;
            border-radius: 10px 10px 0 0;
            position: relative;
        }

        .logo {
            text-align: center;
            margin-bottom: 15px;
        }

        .logo img {
            max-width: 200px;
            height: auto;
        }

        .notification-badge {
            position: absolute;
            top: -15px;
            right: -15px;
            background-color: #ef4444;
            color: white;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        }

        .admin-alert {
            background-color: #2d3748;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            font-weight: bold;
        }

        .details {
            line-height: 1.6;
        }

        .footer {
            margin-top: 25px;
            text-align: center;
            color: #666666;
            font-size: 14px;
            padding-top: 20px;
            border-top: 1px solid #eaeaea;
        }

        .highlight-text {
            color: #ef4444;
            font-weight: bold;
        }

        .rejection-banner {
            background: #fee2e2;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 5px solid #ef4444;
        }

        .appointment-details {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
        }

        .details-table {
            width: 100%;
            border-collapse: collapse;
        }

        .details-table td {
            padding: 10px;
            vertical-align: top;
            border-bottom: 1px solid #e2e8f0;
        }

        .details-table tr:last-child td {
            border-bottom: none;
        }

        .label {
            font-weight: bold;
            color: #4a5568;
            width: 30%;
        }

        .status-tag {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            background-color: #ef4444;
            color: white;
        }

        .reason-list {
            padding-left: 20px;
            margin-bottom: 20px;
        }

        .reason-list li {
            margin-bottom: 8px;
            padding-left: 5px;
        }

        .action-button {
            display: inline-block;
            background-color: #3182ce;
            color: white;
            text-decoration: none;
            padding: 12px 20px;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 15px;
            transition: background-color 0.3s;
        }

        .action-button:hover {
            background-color: #2c5282;
        }

        .timeline {
            margin: 20px 0;
            position: relative;
            padding-left: 30px;
        }

        .timeline:before {
            content: '';
            position: absolute;
            left: 0;
            top: 5px;
            bottom: 5px;
            width: 2px;
            background: #e2e8f0;
        }

        .timeline-item {
            position: relative;
            margin-bottom: 15px;
            padding-bottom: 15px;
        }

        .timeline-item:before {
            content: '';
            position: absolute;
            left: -30px;
            top: 0;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ef4444;
            border: 2px solid white;
        }

        .timeline-date {
            font-size: 12px;
            color: #718096;
            margin-bottom: 5px;
        }

        .timeline-content {
            padding: 10px;
            background: #f8fafc;
            border-radius: 5px;
            border: 1px solid #e2e8f0;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="header">
            <div class="notification-badge">🔔</div>
            <div class="logo">
                <!-- Logo text fallback in case image doesn't exist -->
                <h1 style="color: white; margin: 0; font-size: 22px; text-align: center;">V General Contractors</h1>
            </div>
        </div>

        <div class="admin-alert">
            NOTIFICACIÓN DE ADMINISTRADOR: Alerta de Rechazo de Cita
        </div>

        <div class="details">
            <p>Estimado Administrador,</p>

            <p>Esta es una notificación automática para informarle que una cita ha sido <span
                    class="highlight-text">rechazada</span>. Por favor revise los detalles a continuación:</p>

            <div class="rejection-banner">
                <h3 style="margin-top: 0; color: #ef4444;">Razones del Rechazo:</h3>
                <ul class="reason-list">
                    @if ($noRoof)
                        <li>El cliente indicó que no necesita un techo nuevo.</li>
                    @endif

                    @if ($notOwner)
                        <li>El cliente no es el propietario de la vivienda.</li>
                    @endif

                    @if ($noInsurance)
                        <li>El cliente no tiene cobertura de seguro.</li>
                    @endif

                    @if ($areaNotServiced)
                        <li>La ubicación del cliente está fuera de nuestra área de servicio.</li>
                    @endif

                    @if ($duplicateEntry)
                        <li>Esta es una entrada duplicada.</li>
                    @endif

                    @if ($canceledByCustomer)
                        <li>La cita fue cancelada por el cliente.</li>
                    @endif

                    @if ($unsuccessfulContact)
                        <li>No fue posible establecer contacto con el cliente.</li>
                    @endif

                    @if ($otherReason)
                        <li>{{ $otherReason }}</li>
                    @endif
                </ul>
            </div>

            <div class="appointment-details">
                <h3 style="color: #2d3748; margin-top: 0;">Detalles de la Cita:</h3>
                <table class="details-table">
                    <tr>
                        <td class="label">Estado:</td>
                        <td><span class="status-tag">Rechazada</span></td>
                    </tr>
                    <tr>
                        <td class="label">Nombre del Cliente:</td>
                        <td>{{ $appointment->first_name }} {{ $appointment->last_name }}</td>
                    </tr>
                    <tr>
                        <td class="label">Correo Electrónico:</td>
                        <td>{{ $appointment->email ?? 'No proporcionado' }}</td>
                    </tr>
                    <tr>
                        <td class="label">Teléfono:</td>
                        <td>{{ $appointment->phone ?? 'No proporcionado' }}</td>
                    </tr>
                    <tr>
                        <td class="label">Fecha de Cita:</td>
                        <td>
                            @if ($appointment->inspection_date)
                                @php
                                    $inspectionDate = \Carbon\Carbon::parse($appointment->inspection_date);
                                    $formattedDate = $inspectionDate
                                        ->locale('es')
                                        ->isoFormat('dddd D [de] MMMM [de] YYYY');
                                    echo ucfirst($formattedDate);
                                @endphp
                            @else
                                No especificada
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td class="label">Hora de Cita:</td>
                        <td>
                            @if ($appointment->inspection_time)
                                {{ $appointment->inspection_time }}
                            @else
                                No especificada
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td class="label">Dirección:</td>
                        <td>
                            {{ $appointment->address ?? 'No especificada' }}
                            @if ($appointment->address_2)
                                <br>{{ $appointment->address_2 }}
                            @endif
                            @if ($appointment->city)
                                <br>{{ $appointment->city }}, {{ $appointment->state }} {{ $appointment->zipcode }}
                                <br>{{ $appointment->country ?? 'USA' }}
                            @endif
                        </td>
                    </tr>
                    @if ($appointment->service_type)
                        <tr>
                            <td class="label">Tipo de Servicio:</td>
                            <td>{{ $appointment->service_type }}</td>
                        </tr>
                    @endif
                    @if ($appointment->lead_source)
                        <tr>
                            <td class="label">Fuente del Lead:</td>
                            <td>{{ $appointment->lead_source }}</td>
                        </tr>
                    @endif
                    @if ($appointment->insurance_company)
                        <tr>
                            <td class="label">Compañía de Seguros:</td>
                            <td>{{ $appointment->insurance_company }}</td>
                        </tr>
                    @endif
                    @if ($appointment->mortgage_company)
                        <tr>
                            <td class="label">Compañía Hipotecaria:</td>
                            <td>{{ $appointment->mortgage_company }}</td>
                        </tr>
                    @endif
                    @if ($appointment->notes)
                        <tr>
                            <td class="label">Notas:</td>
                            <td>{{ $appointment->notes }}</td>
                        </tr>
                    @endif
                </table>
            </div>

            <div class="timeline">
                <h3 style="color: #2d3748; margin-top: 0;">Cronología del Rechazo:</h3>
                <div class="timeline-item">
                    <div class="timeline-date">
                        {{ \Carbon\Carbon::parse($appointment->created_at)->format('d M, Y - h:i A') }}</div>
                    <div class="timeline-content">
                        <strong>Cita Creada</strong>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-date">
                        {{ \Carbon\Carbon::parse($appointment->updated_at)->format('d M, Y - h:i A') }}</div>
                    <div class="timeline-content">
                        <strong>Cita Rechazada</strong>
                    </div>
                </div>
            </div>

            <p><strong>Acción Requerida:</strong> No se requiere acción inmediata. Esta notificación es para su
                información y mantenimiento de registros.</p>

            <center>
                <a href="{{ url('/appointments') }}" class="action-button">Ver Todas las Citas</a>
            </center>
        </div>

        <div class="footer">
            <p>Esta es una notificación automática del sistema de gestión de citas de V General Contractors.</p>
            <p>&copy; {{ date('Y') }} V General Contractors. Todos los derechos reservados.</p>
        </div>
    </div>
</body>

</html>
