import React, { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import styled from 'styled-components';
import { nanoid } from 'nanoid';

const StopReport = ({ dataEmit }) => {
    const [data, setData] = useState(() => {
        const savedData = localStorage.getItem('realTimeTableData');
        return savedData ? JSON.parse(savedData) : [];
    });
    const [textInputs, setTextInputs] = useState({});
    const [editing, setEditing] = useState({});

    useEffect(() => {
        localStorage.setItem('realTimeTableData', JSON.stringify(data));
    }, [data]);

    useEffect(() => {
        const newId = nanoid();
        if (!data.some(item => item.id === newId)) {
            const newDataObject = {
                id: newId,
                status: dataEmit.status,
                timestamp: dataEmit.timestamp ? new Date(dataEmit.timestamp).toLocaleString() : '',
                remarks: '',
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString()
            };

            setData(prevData => [...prevData, newDataObject]);
        }
    }, [dataEmit]);

    const handleText = (e, id) => {
        setTextInputs({
            ...textInputs,
            [id]: e.target.value
        });
    };

    const handleClick = (id) => {
        setData(prevData =>
            prevData.map(item =>
                item.id === id ? { ...item, remarks: textInputs[id] || '' } : item
            )
        );
        setEditing({ ...editing, [id]: false });
    };

    const handleEdit = (id) => {
        setEditing({ ...editing, [id]: true });
        setTextInputs({ ...textInputs, [id]: data.find(item => item.id === id).remarks });
    };

    const handleClearData = () => {
        setData([]);
        setTextInputs({});
        setEditing({});
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');

        worksheet.columns = [
            { header: 'S.No', key: 'serial', width: 10 },
            { header: 'ID', key: 'id', width: 32 },
            { header: 'Status', key: 'status', width: 32 },
            { header: 'Timestamp', key: 'timestamp', width: 32 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 50 }
        ];

        data.forEach((item, index) => {
            worksheet.addRow({
                serial: index + 1,
                id: item.id,
                status: item.status,
                timestamp: item.timestamp,
                date: item.date,
                time: item.time,
                remarks: item.remarks
            });
        });

        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
                cell.font = { name: 'Arial', size: 12 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                if (rowNumber === 1) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFF00' }
                    };
                }
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        saveAs(blob, "data.xlsx");
    };

    return (
        <Wrapper>
            <div className='table'>
                <div className='cell serial'>S.No</div>
                <div className='cell id'>ID</div>
                <div className='cell status'>Status</div>
                <div className='cell timestamp'>Timestamp</div>
                <div className='cell date'>Date</div>
                <div className='cell time'>Time</div>
                <div className='cell remark'>Remarks</div>
                {data.map((el, index) => (
                    <React.Fragment key={el.id}>
                        <div className='cell serial'>{index + 1}</div>
                        <div className='cell id'>{el.id}</div>
                        <div className='cell status'>{el.status}</div>
                        <div className='cell timestamp'>{el.timestamp}</div>
                        <div className='cell date'>{el.date}</div>
                        <div className='cell time'>{el.time}</div>
                        <div className='cell remark'>
                            {editing[el.id] ? (
                                <div className='edit'>
                                    <input
                                        type="text"
                                        onChange={(e) => handleText(e, el.id)}
                                        value={textInputs[el.id] || ''}
                                        placeholder="Edit remark"
                                    />
                                    <div>
                                        <button onClick={() => handleClick(el.id)}>Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className='edit'>
                                    <div className='text'>{el.remarks}</div>
                                    <div>
                                        <button onClick={() => handleEdit(el.id)}>Add/Edit</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                ))}
            </div>
            <div className="buttons">
                <button onClick={exportToExcel}>Export to Excel</button>
                <button onClick={handleClearData}>Clear Data</button>
            </div>
        </Wrapper>
    );
};

const Wrapper = styled.div`
    color: #4deeea;
    background-color: #0e254a;
    .edit{
        display: flex;
        flex-direction: column;
    }

    .nav-inner {
        text-align: center;
        color: #4deeea;
    }

    .nav {
        background-color: #0e254a;
        display: flex;
        justify-content: space-evenly;
        font-size: 2.8rem;
    }

    .buttons button {
        padding: 0.3rem;
    }

    .nav {
        grid-column: 1/-1;
    }

    .buttons {
        display: flex;
        width: 100%;
        height: 100px;
        justify-content: space-evenly;
        align-items: center;
    }

    button {
        background-color: #82ca9d;
        border: none;
    }

    .table {
        display: grid;
        grid-template-columns: 0.1fr 0.3fr 0.4fr 0.4fr 0.4fr 0.4fr 1fr;
        gap: 3.5px;
        border: 1px solid #ccc;
        max-height: 65vh;
        overflow-y: auto;
    }

    .cell {
        padding: 10px;
        border: 1px solid #ccc;
        white-space: normal;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .cell.serial { grid-column: 1/2; }
    .cell.id { grid-column: 2/3; }
    .cell.status { grid-column: 3/4; }
    .cell.timestamp { grid-column: 4/5; }
    .cell.date { grid-column: 5/6; color: #82ca9d; }
    .cell.time { grid-column: 6/7; color: #8884d8; }
    .cell.remark { grid-column: 7/8; display: flex; flex-direction: column; justify-content: space-evenly; }

    .edit {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .text {
        word-wrap: break-word;
        overflow-wrap: break-word;
        white-space: pre-wrap;
    }

    input {
        width: 100%;
        padding: 0.3rem;
    }

    input:focus {
        outline: none;
    }
`;

export default StopReport;
